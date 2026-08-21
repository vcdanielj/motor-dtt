// UI-side save helpers (touch the DOM) — NOT usable from the worker. Prefer the File System
// Access API's showSaveFilePicker (Chrome/Edge desktop); fall back to an anchor download for
// browsers that lack it (Firefox/Safari — see src/lib/browser.ts).
//
// CRITICAL ordering rule: showSaveFilePicker only works while the browser still holds *transient
// user activation* — roughly 5 seconds after the click. A big export takes far longer than that,
// so a caller that exports first and asks where to save afterwards ALWAYS fails with
// "Must be handling a user gesture to show a file picker". Long exports must therefore call
// `pickSaveTarget` inside the click handler (before any slow await) and `writeToTarget` at the end.
// `saveBlob` keeps the pick+write pair together and stays fine for small, fast exports.

export type SaveOutcome = 'saved' | 'cancelled' | 'fallback'

export type SaveTypeOption = { description: string; accept: Record<string, string[]> }

interface WritableFileStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<WritableFileStream>
}

type ShowSaveFilePicker = (options?: {
  suggestedName?: string
  types?: SaveTypeOption[]
}) => Promise<FileSystemFileHandleLike>

/** Where a save is headed, decided up front while the user gesture is still valid.
 *  - `handle`: the user picked a destination; write to it whenever the data is ready.
 *  - `cancelled`: the user dismissed the picker — the caller should skip the work entirely.
 *  - `unavailable`: no picker in this browser, or it refused; the write falls back to an
 *    anchor download, which needs no gesture and therefore always delivers the file. */
export type SaveTarget =
  | { kind: 'handle'; handle: FileSystemFileHandleLike }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }

const DEFAULT_TYPES: SaveTypeOption[] = [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }]

function getPicker(): ShowSaveFilePicker | null {
  const picker = (globalThis as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker
  return typeof picker === 'function' ? picker : null
}

/** Ask the user where to save, NOW. Must be called from the click handler, before any slow await.
 *  Never throws: a browser without the API, or one that refuses the picker (expired gesture,
 *  blocked permission), resolves to 'unavailable' so the caller can still deliver the file. */
export async function pickSaveTarget(
  suggestedName: string,
  typeOptions?: SaveTypeOption[],
): Promise<SaveTarget> {
  const picker = getPicker()
  if (!picker) return { kind: 'unavailable' }
  try {
    const handle = await picker({ suggestedName, types: typeOptions ?? DEFAULT_TYPES })
    return { kind: 'handle', handle }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { kind: 'cancelled' }
    // SecurityError / NotAllowedError ("must be handling a user gesture", denied permission…):
    // the picker is unusable, but losing the user's export over it would be far worse.
    return { kind: 'unavailable' }
  }
}

/** Anchor download — needs no user gesture, works in every browser. */
function descargaAnclada(blob: Blob, suggestedName: string): SaveOutcome {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking synchronously can cancel the download before the browser has read the blob (Firefox
  // and Safari both do this on large files). Defer it to the next task instead.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'fallback'
}

/** Write the finished blob to the destination picked earlier. A genuine write failure (disk full,
 *  revoked permission mid-write) propagates — that is a real problem the analyst must see. */
export async function writeToTarget(
  target: SaveTarget,
  blob: Blob,
  suggestedName: string,
): Promise<SaveOutcome> {
  if (target.kind === 'cancelled') return 'cancelled'
  if (target.kind === 'handle') {
    const writable = await target.handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return 'saved'
  }
  return descargaAnclada(blob, suggestedName)
}

/** Pick a destination and write in one step. Correct for small, fast exports (the learned-config
 *  CSVs), where the data is ready within the user-activation window. For anything slow, use
 *  pickSaveTarget + writeToTarget so the picker opens while the gesture is still alive. */
export async function saveBlob(
  blob: Blob,
  suggestedName: string,
  typeOptions?: SaveTypeOption[],
): Promise<SaveOutcome> {
  const target = await pickSaveTarget(suggestedName, typeOptions)
  return writeToTarget(target, blob, suggestedName)
}
