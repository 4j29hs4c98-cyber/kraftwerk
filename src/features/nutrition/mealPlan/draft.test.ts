import { describe, expect, it } from 'vitest'
import { draftFromItems, draftToItems, newDraftMeal, nextVariantName, removeDraftMeal, renameDraftVariant, updateDraftMeal } from './draft'

describe('meal plan draft', () => {
  it('round-trips items through the text fields', () => {
    const draft = draftFromItems([
      { dayKey: 'training', mealSlot: 'vor_training', name: 'Reis', amount: '150 g', kcal: 420, proteinG: 35.5, carbsG: 55, fatG: null, notes: null, variant: 'Reis-Variante' },
      { dayKey: 'alle', mealSlot: 'fruehstueck', name: 'Shake', amount: null, kcal: 160, proteinG: 32, carbsG: 3, fatG: 2, notes: 'mit Wasser', variant: null },
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
      variant: 'Reis-Variante',
    })
    expect(draft[0]?.variant).toBe('')
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

  it('names new variants and renames all items of a variant', () => {
    const a = newDraftMeal('mo', 'mittag', 'Variante 1')
    const b = newDraftMeal('mo', 'mittag', 'Variante 1')
    const other = newDraftMeal('di', 'mittag', 'Variante 1')
    const draft = [a, b, other]
    expect(nextVariantName(draft, 'mo', 'mittag')).toBe('Variante 2')
    expect(nextVariantName(draft, 'mo', 'abend')).toBe('Variante 1')
    const renamed = renameDraftVariant(draft, 'mo', 'mittag', 'Variante 1', 'Pasta')
    expect(renamed.map((m) => m.variant)).toEqual(['Pasta', 'Pasta', 'Variante 1'])
    expect(draft[0]?.variant).toBe('Variante 1')
    const result = draftToItems(renamed.map((m) => ({ ...m, name: 'x' })))
    expect(result.ok && result.items.map((i) => i.variant)).toEqual(['Pasta', 'Pasta', 'Variante 1'])
  })
})
