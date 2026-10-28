import { describe, expect, it } from 'vitest'
import type { PlanDetail } from '../api'
import { addExercise, addRestDay, draftFromDetail, draftToPlan, moveExercise, newExercise, removeDay, removeExercise, renameDay, setDayRest, setDayWeekday, updateExercise } from './draft'

const exRow = (key: string, position: number, extra: Partial<PlanDetail['days'][number]['exercises'][number]> = {}) => ({
  id: key,
  plan_day_id: 'd1',
  user_id: 'u',
  exercise_key: key,
  position,
  sets: 3,
  rep_min: 8,
  rep_max: 12,
  rest_seconds: 120,
  created_at: '',
  display_name: null,
  notes: null,
  start_weight_kg: null,
  ...extra,
})

const detail: PlanDetail = {
  plan: { id: 'p', user_id: 'u', name: 'Mein Plan', split: 'ober_unter', is_active: true, created_at: '' },
  days: [
    {
      id: 'd1',
      weekday: null,
      is_rest: false,
      plan_id: 'p',
      user_id: 'u',
      day_index: 0,
      title: 'Oberkörper A',
      created_at: '',
      exercises: [exRow('bankdruecken_lh', 0), exRow('latzug', 1, { start_weight_kg: 60, notes: 'Eng greifen' })],
    },
  ],
}

describe('plan draft', () => {
  const draft = draftFromDetail(detail)
  const dayUid = draft.days[0]!.uid

  it('round-trips an unchanged plan with the same name and split', () => {
    const result = draftToPlan(draft)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.name).toBe('Mein Plan')
    expect(result.plan.split).toBe('ober_unter')
    expect(result.plan.days[0]!.exercises[1]).toMatchObject({ exerciseKey: 'latzug', startWeightKg: 60, notes: 'Eng greifen', displayName: null })
  })

  it('renames, adds, moves and removes without mutating', () => {
    const custom = newExercise({ customName: 'Schräge Brustpresse' })
    let next = renameDay(draft, dayUid, 'Push')
    next = addExercise(next, dayUid, custom)
    next = moveExercise(next, dayUid, custom.uid, -1)
    next = removeExercise(next, dayUid, draft.days[0]!.exercises[0]!.uid)
    const result = draftToPlan(next)
    expect(result.ok && result.plan.days[0]).toMatchObject({
      title: 'Push',
      exercises: [{ exerciseKey: 'custom:schraege_brustpresse', displayName: 'Schräge Brustpresse', restSeconds: 90 }, { exerciseKey: 'latzug' }],
    })
    expect(draft.days[0]!.exercises).toHaveLength(2)
  })

  it('gives a second custom exercise with the same name its own key', () => {
    const next = addExercise(addExercise(draft, dayUid, newExercise({ customName: 'Dips' })), dayUid, newExercise({ customName: 'Dips' }))
    expect(next.days[0]!.exercises.map((e) => e.exerciseKey).slice(2)).toEqual(['custom:dips', 'custom:dips_2'])
  })

  it('reports invalid fields in German', () => {
    const ex = draft.days[0]!.exercises[0]!
    const bad = updateExercise(updateExercise(draft, dayUid, ex.uid, { repMin: '12', repMax: '8' }), dayUid, ex.uid, { startWeight: 'viel' })
    const result = draftToPlan(renameDay(bad, dayUid, ''))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual([
      'Tag 1: Bitte gib dem Tag einen Namen.',
      'Tag 1, Übung 1: "Wdh. von" darf nicht größer sein als "Wdh. bis".',
      'Tag 1, Übung 1: Das Startgewicht muss zwischen 0 und 1000 kg liegen.',
    ])
  })
})

describe('weekdays and rest days in the draft', () => {
  const base = draftFromDetail({ ...detail, days: detail.days.map((d) => ({ ...d, weekday: 0 })) })

  it('adds a rest day on the first free weekday and saves it without exercises', () => {
    const next = addRestDay(base)
    expect(next.days[1]).toMatchObject({ title: 'Ruhetag', weekday: 1, isRest: true })
    const result = draftToPlan(next)
    expect(result.ok && result.plan.days.map((d) => [d.weekday, d.isRest, d.exercises.length])).toEqual([
      [0, false, 2],
      [1, true, 0],
    ])
  })

  it('marking a day as rest keeps the exercises in the draft but saves none; unmarking needs a new name', () => {
    const second = addRestDay(base)
    const restUid = second.days[0]!.uid
    const marked = setDayRest(second, restUid, true)
    expect(marked.days[0]).toMatchObject({ isRest: true, title: 'Ruhetag' })
    expect(marked.days[0]!.exercises).toHaveLength(2)
    expect(draftToPlan(marked)).toMatchObject({ ok: false })
    const back = setDayRest(marked, restUid, false)
    expect(back.days[0]).toMatchObject({ isRest: false, title: '' })
  })

  it('changes and removes days', () => {
    const next = removeDay(setDayWeekday(addRestDay(base), base.days[0]!.uid, 3), base.days[0]!.uid)
    expect(next.days).toHaveLength(1)
    expect(draftToPlan(next)).toMatchObject({ ok: false })
  })
})
