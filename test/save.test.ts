import { test, expect, afterEach } from 'vitest'
import { saveBlob } from '@/reports/save'

// jsdom doesn't implement showSaveFilePicker by default, so the fallback tests need no setup;
// the FS-Access tests install/remove a fake picker around themselves.
afterEach(() => {
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
})

test('fallback path (no showSaveFilePicker): creates+clicks a download anchor, never throws, returns fallback', async () => {
  let createdFor: Blob | undefined
  let revokedUrl: string | undefined
  let clicked = false
  ;(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
    createdFor = b
    return 'blob:fake-url'
  }
  ;(URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = (u: string) => {
    revokedUrl = u
  }
  const originalClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    clicked = true
  }

  const blob = new Blob(['a,b\n1,2\n'], { type: 'text/csv' })
  const outcome = await saveBlob(blob, 'base.csv')

  expect(outcome).toBe('fallback')
  expect(createdFor).toBe(blob)
  expect(clicked).toBe(true)

  // The object URL is revoked on the next task, not synchronously — revoking before the browser
  // has read the blob cancels the download on Firefox/Safari.
  expect(revokedUrl).toBeUndefined()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(revokedUrl).toBe('blob:fake-url')

  HTMLAnchorElement.prototype.click = originalClick
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

test('a non-abort error from the picker still propagates (not silently swallowed)', async () => {
  ;(window as unknown as { showSaveFilePicker: () => Promise<unknown> }).showSaveFilePicker = async () => {
    throw new Error('disk full')
  }

  await expect(saveBlob(new Blob(['x']), 'run.csv')).rejects.toThrow(/disk full/)
})
