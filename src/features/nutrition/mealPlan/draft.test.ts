import { describe, expect, it } from 'vitest'
import { draftFromItems, draftToItems, newDraftMeal, removeDraftMeal, updateDraftMeal } from './draft'

describe('meal plan draft', () => {
  it('round-trips items through the text fields', () => {
    const draft = draftFromItems([
      { dayKey: 'training', mealSlot: 'vor_training', name: 'Reis', amount: '150 g', kcal: 420, proteinG: 35.5, carbsG: 55, fatG: null, notes: null },
      { dayKey: 'alle', mealSlot: 'fruehstueck', name: 'Shake', amount: null, kcal: 160, proteinG: 32, carbsG: 3, fatG: 2, notes: 'mit Wasser' },
    ])
    expect(draft.map((d) => d.name)).toEqual(['Shake', 'Reis'])
    expect(draft[1]?.protein).toBe('35,5')
    const result = draftToItems(draft)
    expect(result.ok && result.items[1]).toEqual({
      dayKey: 'training',
      mealSlot: 'vor_training',
      name: 'Reis',
      amount: '150 g',
      kcal: 420,
      proteinG: 35.5,
      carbsG: 55,
      fatG: null,
      notes: null,
    })
  })

  it('adds, updates and removes without mutating', () => {
    const start = [newDraftMeal('mo', 'mittag')]
    const uid = start[0]?.uid ?? ''
    const updated = updateDraftMeal(start, uid, { name: 'Pasta', kcal: '600' })
    expect(start[0]?.name).toBe('')
    expect(updated[0]?.name).toBe('Pasta')
    expect(removeDraftMeal(updated, uid)).toEqual([])
  })

  it('reports invalid numbers and missing names', () => {
    const withText = [{ ...newDraftMeal('mo', 'mittag'), name: 'Brot', kcal: 'viel' }]
    const result = draftToItems(withText)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors[0]).toContain('als Zahl')
    const noName = draftToItems([newDraftMeal('mo', 'mittag')])
    expect(!noName.ok && noName.errors[0]).toContain('Name fehlt')
    expect(draftToItems([]).ok).toBe(false)
  })
})
