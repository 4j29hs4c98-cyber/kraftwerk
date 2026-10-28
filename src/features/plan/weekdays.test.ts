import { describe, expect, it } from 'vitest'
import { orderDays, toCreatePlanArgs, validatePlan, type NewPlan } from './planModel'
import { hasWeekdays, isPlannedTrainingDay, parseWeekday, planForWeekday, weekdayOf, weekSlots } from './weekdays'

const day = (weekday: number | null, isRest = false, id = `d${weekday}`) => ({ id, weekday, is_rest: isRest })

describe('parseWeekday', () => {
  it('reads long, short and English names', () => {
    expect(['Montag', 'mo', 'Mo.', 'DIENSTAG', 'Mi', 'Do', 'Freitag', 'Sa', 'Sonntag', 'Sunday'].map(parseWeekday)).toEqual([0, 0, 0, 1, 2, 3, 4, 5, 6, 6])
  })

  it('returns null for anything else', () => {
    expect(['Tag 1', '', 'A', 'Push'].map(parseWeekday)).toEqual([null, null, null, null])
  })
})

describe('week logic', () => {
  // Mo Ober, Di Unter, Mi Ruhetag, Do Push, Fr Pull, Sa Beine, So Ruhetag
  const week = [day(0), day(1), day(2, true), day(3), day(4), day(5), day(6, true)]

  it('weekdayOf counts Monday as 0', () => {
    expect(weekdayOf(new Date(2026, 9, 26))).toBe(0) // Montag
    expect(weekdayOf(new Date(2026, 10, 1))).toBe(6) // Sonntag
  })

  it('a training weekday is today', () => {
    expect(planForWeekday(week, 3)).toEqual({ kind: 'training', day: week[3] })
  })

  it('a rest day points to the next training day, also across the week end', () => {
    expect(planForWeekday(week, 2)).toEqual({ kind: 'rest', day: week[2], next: { day: week[3], weekday: 3 } })
    expect(planForWeekday(week, 6)).toEqual({ kind: 'rest', day: week[6], next: { day: week[0], weekday: 0 } })
  })

  it('a weekday without entry counts as rest day', () => {
    const short = [day(0), day(3)]
    expect(planForWeekday(short, 1)).toEqual({ kind: 'rest', day: null, next: { day: short[1], weekday: 3 } })
    expect(weekSlots(short).map((s) => s.day?.id ?? null)).toEqual(['d0', null, null, 'd3', null, null, null])
  })

  it('isPlannedTrainingDay only answers for plans with weekdays', () => {
    expect(isPlannedTrainingDay(week, new Date(2026, 9, 28))).toBe(false) // Mittwoch
    expect(isPlannedTrainingDay(week, new Date(2026, 9, 29))).toBe(true) // Donnerstag
    expect(isPlannedTrainingDay([day(null)], new Date(2026, 9, 28))).toBeNull()
    expect(hasWeekdays([day(0), day(null)])).toBe(false)
  })
})

describe('plan model with weekdays and rest days', () => {
  const ex = { exerciseKey: 'kniebeuge_lh', sets: 3, repMin: 5, repMax: 8, restSeconds: 120 }
  const plan = (days: NewPlan['days']): NewPlan => ({ name: 'Woche', split: 'import', days })

  it('accepts rest days without exercises and stores days Monday to Sunday', () => {
    const p = plan([
      { title: 'Beine', weekday: 3, exercises: [ex] },
      { title: 'Ruhetag', weekday: 2, isRest: true, exercises: [] },
    ])
    expect(validatePlan(p)).toEqual([])
    expect(orderDays(p.days).map((d) => d.weekday)).toEqual([2, 3])
    expect(toCreatePlanArgs(p).p_days.map((d) => [d.day_index, d.weekday, d.is_rest, d.exercises.length])).toEqual([
      [0, 2, true, 0],
      [1, 3, false, 1],
    ])
  })

  it('rejects mixed or duplicate weekdays, rest days with exercises and plans without training', () => {
    expect(validatePlan(plan([{ title: 'A', weekday: 0, exercises: [ex] }, { title: 'B', exercises: [ex] }]))).toContain(
      'Entweder bekommen alle Tage einen Wochentag oder keiner.',
    )
    expect(validatePlan(plan([{ title: 'A', weekday: 0, exercises: [ex] }, { title: 'B', weekday: 0, exercises: [ex] }]))).toContain(
      'Jeder Wochentag darf nur einmal im Plan vorkommen.',
    )
    expect(validatePlan(plan([{ title: 'A', exercises: [ex] }, { title: 'Ruhetag', isRest: true, exercises: [ex] }]))).toContain(
      'Tag 2 (Ruhetag): Ein Ruhetag hat keine Übungen.',
    )
    expect(validatePlan(plan([{ title: 'Ruhetag', isRest: true, exercises: [] }]))).toContain('Der Plan braucht mindestens einen Trainingstag.')
  })

  it('plans without weekdays send weekday null and keep their order', () => {
    const args = toCreatePlanArgs(plan([{ title: 'B', exercises: [ex] }, { title: 'A', exercises: [ex] }]))
    expect(args.p_days.map((d) => [d.title, d.weekday, d.is_rest])).toEqual([['B', null, false], ['A', null, false]])
  })
})
