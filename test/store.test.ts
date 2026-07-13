import { useStore } from '@/state/store'

test('store seeds & mocks conform to contracts', () => {
  const s = useStore.getState()
  expect(s.seeds.segmentos).toHaveLength(35)
  expect(s.distribuidores.length).toBeGreaterThan(0)
  expect(s.view).toBe('dashboard')
})

test('setView switches views', () => {
  useStore.getState().setView('cola')
  expect(useStore.getState().view).toBe('cola')
})
