import { detectBrowser } from '@/lib/browser'

test('warns on Firefox', () => {
  const c = detectBrowser('Mozilla/5.0 Firefox/123')
  expect(c.warnings.join(' ')).toMatch(/Chrome o Edge/)
})

test('Chrome UA is clean', () => {
  const c = detectBrowser('Mozilla/5.0 Chrome/124 Safari/537')
  expect(c.warnings).toHaveLength(0)
})
