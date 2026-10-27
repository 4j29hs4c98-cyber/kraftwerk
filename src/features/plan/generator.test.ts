import { describe, expect, it } from 'vitest'
import { ALL_EQUIPMENT, type TrainingProfile } from '../profile/types'
import { EXERCISES, getExercise, isAvailable } from './exercises'
import { generatePlan, MIN_EXERCISES_PER_DAY, nextDayIndex, splitForDays, volumeFor } from './generator'

const gym: TrainingProfile = { goal: 'muskelaufbau', level: 'fortgeschritten', daysPerWeek: 4, location: 'gym', equipment: ALL_EQUIPMENT }
const homeNothing: TrainingProfile = { goal: 'fitness', level: 'anfaenger', daysPerWeek: 3, location: 'home', equipment: [] }

describe('exercise library', () => {
  it('has unique keys and roughly 40+ exercises', () => {
    const keys = EXERCISES.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBeGreaterThanOrEqual(40)
  })
})

describe('splitForDays', () => {
  it.each([
    [2, 'ganzkoerper', 2],
    [3, 'ganzkoerper', 2],
    [4, 'ober_unter', 4],
    [5, 'ppl_ober_unter', 5],
    [6, 'ppl', 6],
  ])('%i Tage -> %s mit %i Plantagen', (days, key, count) => {
    const split = splitForDays(days)
    expect(split.key).toBe(key)
    expect(split.days).toHaveLength(count)
  })
})

describe('generatePlan', () => {
  it('is deterministic', () => {
    expect(generatePlan(gym)).toEqual(generatePlan(gym))
  })

  it('only uses exercises the user has equipment for', () => {
    for (const profile of [homeNothing, { ...homeNothing, equipment: ['kurzhanteln', 'baender'] as const }]) {
      const plan = generatePlan(profile)
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          const exercise = getExercise(ex.exerciseKey)
          expect(exercise).toBeDefined()
          expect(isAvailable(exercise!, profile.equipment)).toBe(true)
        }
      }
    }
  })

  it('builds a usable bodyweight plan without any equipment', () => {
    const plan = generatePlan(homeNothing)
    expect(plan.days).toHaveLength(2)
    for (const day of plan.days) expect(day.exercises.length).toBeGreaterThanOrEqual(4)
  })

  it.each([2, 3, 4, 5, 6])('without equipment and %i days: every day has at least 4 exercises', (days) => {
    const plan = generatePlan({ ...homeNothing, daysPerWeek: days })
    for (const day of plan.days) expect(day.exercises.length).toBeGreaterThanOrEqual(MIN_EXERCISES_PER_DAY)
  })

  it.each([5, 6])('without equipment and %i days: falls back to full body A/B', (days) => {
    const plan = generatePlan({ ...homeNothing, daysPerWeek: days })
    expect(plan.split).toBe('ganzkoerper')
    expect(plan.days).toHaveLength(2)
  })

  it('never puts a pressing exercise on a pull day', () => {
    const pressing = new Set(['brust', 'trizeps'])
    const owned = [[], ['maschinen'], ['baender'], ['kurzhanteln'], ALL_EQUIPMENT] as const
    for (const equipment of owned) {
      for (let days = 2; days <= 6; days++) {
        for (const day of generatePlan({ ...gym, equipment, daysPerWeek: days }).days.filter((d) => d.title.startsWith('Pull'))) {
          for (const ex of day.exercises) {
            const exercise = getExercise(ex.exerciseKey)!
            expect(pressing.has(exercise.muscle)).toBe(false)
            expect(exercise.muscle === 'schultern' && exercise.type === 'grund').toBe(false)
          }
        }
      }
    }
  })

  it('gives timed exercises a range in seconds', () => {
    const plank = generatePlan(homeNothing).days.flatMap((d) => d.exercises).find((e) => e.exerciseKey === 'plank')
    expect(plank).toMatchObject({ repMin: 30, repMax: 60 })
  })

  it('does not repeat an exercise within one day', () => {
    for (let days = 2; days <= 6; days++) {
      for (const day of generatePlan({ ...gym, daysPerWeek: days }).days) {
        const keys = day.exercises.map((e) => e.exerciseKey)
        expect(new Set(keys).size).toBe(keys.length)
      }
    }
  })

  it('varies A and B days', () => {
    const [a, b] = generatePlan({ ...gym, daysPerWeek: 4 }).days
    expect(a?.exercises.map((e) => e.exerciseKey)).not.toEqual(b?.exercises.map((e) => e.exerciseKey))
  })

  it('applies goal-specific volume and rest', () => {
    const plan = generatePlan(gym)
    const first = plan.days[0]!.exercises[0]!
    expect(getExercise(first.exerciseKey)?.type).toBe('grund')
    expect(first).toMatchObject({ sets: 4, repMin: 8, repMax: 12, restSeconds: 120 })
  })
})

describe('volumeFor', () => {
  it('muscle gain: 3-4 x 8-12', () => {
    expect(volumeFor('muskelaufbau', 'fortgeschritten', 'grund')).toEqual({ sets: 4, repMin: 8, repMax: 12, restSeconds: 120 })
    expect(volumeFor('muskelaufbau', 'fortgeschritten', 'isolation')).toEqual({ sets: 3, repMin: 8, repMax: 12, restSeconds: 60 })
  })
  it('fat loss: 3 x 10-15 with shorter rest', () => {
    const v = volumeFor('fett_verlieren', 'fortgeschritten', 'grund')
    expect(v).toMatchObject({ sets: 3, repMin: 10, repMax: 15 })
    expect(v.restSeconds).toBeLessThan(volumeFor('muskelaufbau', 'fortgeschritten', 'grund').restSeconds)
  })
  it('fitness: 3 x 8-15', () => {
    expect(volumeFor('fitness', 'profi', 'isolation')).toMatchObject({ sets: 3, repMin: 8, repMax: 15, restSeconds: 60 })
  })
  it('beginners get fewer sets, never below 2', () => {
    expect(volumeFor('muskelaufbau', 'anfaenger', 'grund').sets).toBe(3)
    expect(volumeFor('fitness', 'anfaenger', 'grund').sets).toBe(2)
  })
  it('keeps compound rest between 90 and 150 s and isolation at most 60 s', () => {
    for (const goal of ['muskelaufbau', 'fett_verlieren', 'fitness'] as const) {
      for (const level of ['anfaenger', 'fortgeschritten', 'profi'] as const) {
        const g = volumeFor(goal, level, 'grund').restSeconds
        expect(g).toBeGreaterThanOrEqual(90)
        expect(g).toBeLessThanOrEqual(150)
        expect(volumeFor(goal, level, 'isolation').restSeconds).toBeLessThanOrEqual(60)
      }
    }
  })
})

describe('nextDayIndex', () => {
  it('starts at 0 without history', () => expect(nextDayIndex(4, null)).toBe(0))
  it('rotates', () => expect(nextDayIndex(4, 1)).toBe(2))
  it('wraps around', () => expect(nextDayIndex(2, 1)).toBe(0))
})
