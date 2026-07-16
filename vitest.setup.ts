import '@testing-library/jest-dom/vitest'

// jsdom does not implement Worker; provide a minimal no-op stub so
// capability checks like `typeof Worker !== 'undefined'` behave like a
// real browser. Individual tests (e.g. ingest-client) override this with
// their own fakes as needed.
if (typeof (globalThis as { Worker?: unknown }).Worker === 'undefined') {
  class NoopWorker {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: ErrorEvent) => void) | null = null
    postMessage(): void {}
    terminate(): void {}
  }
  ;(globalThis as unknown as { Worker: typeof NoopWorker }).Worker = NoopWorker
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
