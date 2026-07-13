import { tokens } from '@/lib/tokens'
test('brand palette matches spec verbatim', () => {
  expect(tokens.navy).toBe('#0F2B5B')
  expect(tokens.red).toBe('#C8102E')
  expect(tokens.green).toBe('#1E8E3E')
  expect(Object.keys(tokens)).toHaveLength(14)
})
