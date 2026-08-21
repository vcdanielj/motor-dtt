import { test, expect, afterEach, describe } from 'vitest'
import { saveBlob, pickSaveTarget, writeToTarget } from '@/reports/save'

// jsdom doesn't implement showSaveFilePicker by default, so the fallback tests need no setup;
// the FS-Access tests install/remove a fake picker around themselves.
afterEach(() => {
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
})

/** Installs a fake anchor-download environment, returning what it captured. */
function espiarDescargaAnclada() {
  const captura: { blob?: Blob; revokedUrl?: string; clicked: boolean } = { clicked: false }
  ;(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
    captura.blob = b
    return 'blob:fake-url'
  }
  ;(URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u: string) => {
    captura.revokedUrl = u
  }
  const originalClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    captura.clicked = true
  }
  return { captura, restore: () => { HTMLAnchorElement.prototype.click = originalClick } }
}

test('fallback path (no showSaveFilePicker): creates+clicks a download anchor, never throws, returns fallback', async () => {
  const { captura, restore } = espiarDescargaAnclada()

  const blob = new Blob(['a,b\n1,2\n'], { type: 'text/csv' })
  const outcome = await saveBlob(blob, 'base.csv')

  expect(outcome).toBe('fallback')
  expect(captura.blob).toBe(blob)
  expect(captura.clicked).toBe(true)

  // The object URL is revoked on the next task, not synchronously — revoking before the browser
  // has read the blob cancels the download on Firefox/Safari.
  expect(captura.revokedUrl).toBeUndefined()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(captura.revokedUrl).toBe('blob:fake-url')

  restore()
})

test('File System Access path: writes the blob through the picker handle and returns saved', async () => {
  let written: Blob | undefined
  let closed = false
  let suggested: string | undefined
  ;(window as unknown as { showSaveFilePicker: (opts?: { suggestedName?: string }) => Promise<unknown> }).showSaveFilePicker =
    async (opts) => {
      suggested = opts?.suggestedName
      return {
        createWritable: async () => ({
          write: async (data: Blob) => { written = data },
          close: async () => { closed = true },
        }),
      }
    }

  const blob = new Blob(['x'], { type: 'text/csv' })
  const outcome = await saveBlob(blob, 'run.csv')

  expect(outcome).toBe('saved')
  expect(written).toBe(blob)
  expect(closed).toBe(true)
  expect(suggested).toBe('run.csv')
})

test('user cancelling the save picker (AbortError) resolves to cancelled, never throws', async () => {
  const abortErr = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })
  ;(window as unknown as { showSaveFilePicker: () => Promise<unknown> }).showSaveFilePicker = async () => {
    throw abortErr
  }

  await expect(saveBlob(new Blob(['x']), 'run.csv')).resolves.toBe('cancelled')
})

describe('picker refusals never cost the analyst the file', () => {
  // THE production bug: the export ran for ~40s, by which time the click's transient user
  // activation had expired, and Chrome refused the picker with
  // "Must be handling a user gesture to show a file picker" — the finished export was thrown away.
  test('a SecurityError from the picker falls back to an anchor download instead of throwing', async () => {
    const securityErr = Object.assign(
      new Error("Failed to execute 'showSaveFilePicker' on 'Window': Must be handling a user gesture to show a file picker."),
      { name: 'SecurityError' },
    )
    ;(window as unknown as { showSaveFilePicker: () => Promise<unknown> }).showSaveFilePicker = async () => {
      throw securityErr
    }
    const { captura, restore } = espiarDescargaAnclada()

    const blob = new Blob(['x'])
    await expect(saveBlob(blob, 'run.xlsx')).resolves.toBe('fallback')
    expect(captura.clicked).toBe(true)
    expect(captura.blob).toBe(blob)

    restore()
  })

  test('a genuine write failure DOES propagate (real I/O problem, not a picker refusal)', async () => {
    ;(window as unknown as { showSaveFilePicker: () => Promise<unknown> }).showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async () => { throw new Error('disk full') },
        close: async () => {},
      }),
    })

    await expect(saveBlob(new Blob(['x']), 'run.xlsx')).rejects.toThrow(/disk full/)
  })
})

describe('pickSaveTarget / writeToTarget — the split used by slow exports', () => {
  test('pickSaveTarget returns a handle that writeToTarget writes to later', async () => {
    let written: Blob | undefined
    ;(window as unknown as { showSaveFilePicker: () => Promise<unknown> }).showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (data: Blob) => { written = data },
        close: async () => {},
      }),
    })

    const target = await pickSaveTarget('base.xlsx')
    expect(target.kind).toBe('handle')

    // …minutes of exporting happen here in the real app…
    const blob = new Blob(['contenido'])
    expect(await writeToTarget(target, blob, 'base.xlsx')).toBe('saved')
    expect(written).toBe(blob)
  })

  test('pickSaveTarget reports cancelled so the caller can skip the export entirely', async () => {
    const abortErr = Object.assign(new Error('abort'), { name: 'AbortError' })
    ;(window as unknown as { showSaveFilePicker: () => Promise<unknown> }).showSaveFilePicker = async () => {
      throw abortErr
    }
    const target = await pickSaveTarget('base.xlsx')
    expect(target.kind).toBe('cancelled')
    expect(await writeToTarget(target, new Blob(['x']), 'base.xlsx')).toBe('cancelled')
  })

  test('pickSaveTarget reports unavailable when there is no picker, and the write still lands', async () => {
    const target = await pickSaveTarget('base.xlsx')
    expect(target.kind).toBe('unavailable')

    const { captura, restore } = espiarDescargaAnclada()
    expect(await writeToTarget(target, new Blob(['x']), 'base.xlsx')).toBe('fallback')
    expect(captura.clicked).toBe(true)
    restore()
  })
})
