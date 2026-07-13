// UI-side save helper (touches the DOM) — NOT usable from the worker. Prefers the File
// System Access API's showSaveFilePicker (Chrome/Edge desktop); falls back to an
// anchor-download for browsers that lack it (Firefox/Safari — see src/lib/browser.ts).

export type SaveOutcome = 'saved' | 'cancelled' | 'fallback'

interface WritableFileStream {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<WritableFileStream>
}

type ShowSaveFilePicker = (options?: {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}) => Promise<FileSystemFileHandleLike>

/** Save a Blob to disk, letting the user pick the location where the browser supports it.
 *  Resolves to 'saved' (File System Access), 'fallback' (anchor download), or 'cancelled'
 *  (user dismissed the save picker) — never throws on user-cancel. */
export async function saveBlob(blob: Blob, suggestedName: string): Promise<SaveOutcome> {
  const picker = (globalThis as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName,
        types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
      throw err
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'fallback'
}
