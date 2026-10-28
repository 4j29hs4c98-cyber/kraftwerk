import { describe, expect, it } from 'vitest'
import { defaultTrainingDay, parseOverrides, pruneOverrides } from './trainingDay'

// Mo bis So: Training, Training, Ruhetag, Training, Training, Training, Ruhetag
const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, is_rest: weekday === 2 || weekday === 6 }))
const wednesday = new Date(2026, 9, 28)
const thursday = new Date(2026, 9, 29)

describe('defaultTrainingDay', () => {
  it('follows the weekly plan', () => {
    expect(defaultTrainingDay(wednesday, false, week).isTrainingDay).toBe(false)
    expect(defaultTrainingDay(thursday, false, week).isTrainingDay).toBe(true)
  })

  it('a started workout makes it a training day, also on a planned rest day', () => {
    expect(defaultTrainingDay(wednesday, true, week)).toMatchObject({ isTrainingDay: true })
  })

  it('without weekdays it stays as before', () => {
    const rotation = [{ weekday: null, is_rest: false }]
    expect(defaultTrainingDay(thursday, false, rotation).isTrainingDay).toBe(false)
    expect(defaultTrainingDay(thursday, true, rotation).isTrainingDay).toBe(true)
    expect(defaultTrainingDay(thursday, false, []).isTrainingDay).toBe(false)
  })

  it('a weekday without entry counts as rest day', () => {
    expect(defaultTrainingDay(thursday, false, [{ weekday: 0, is_rest: false }]).isTrainingDay).toBe(false)
  })
})

describe('stored overrides', () => {
  it('keeps only date -> boolean entries and survives broken JSON', () => {
    expect(parseOverrides('{"2026-10-28":true,"x":true,"2026-10-27":"ja"}')).toEqual({ '2026-10-28': true })
    expect(parseOverrides('{kaputt')).toEqual({})
    expect(parseOverrides('[1]')).toEqual({})
    expect(parseOverrides(null)).toEqual({})
  })

  it('drops entries older than 60 days', () => {
    expect(pruneOverrides({ '2026-08-28': true, '2026-08-29': false, '2026-10-28': true }, '2026-10-28')).toEqual({
      '2026-08-29': false,
      '2026-10-28': true,
    })
  })
})
