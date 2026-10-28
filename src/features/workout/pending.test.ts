import { describe, expect, it } from 'vitest'
import type { OutboxEntry, OutboxOp } from '../../lib/offline/ops'
import type { WorkoutRow } from './api'
import { applyPendingToLastSets, applyPendingToOpenWorkout, pendingTrainingStarts, referencedWorkoutIds } from './pending'

const entries = (...ops: OutboxOp[]): OutboxEntry[] =>
  ops.map((op, i) => ({ key: `k${i}`, userId: 'u1', createdAt: `2026-10-28T10:0${i}:00.000Z`, op }))

const input = { planDayId: 'd1', userId: 'u1', since: '2026-10-28T00:00:00.000Z' }
const start = (id: string, startedAt = '2026-10-28T10:00:00.000Z'): OutboxOp => ({ kind: 'workout.start', id, planDayId: 'd1', startedAt })
const set = (workoutId: string, setIndex: number, weightKg = 60): OutboxOp => ({ kind: 'set.upsert', workoutId, exerciseKey: 'bench', setIndex, weightKg, reps: 8 })

const serverWorkout: WorkoutRow = { id: 'srv', user_id: 'u1', plan_day_id: 'd1', started_at: '2026-10-28T09:00:00.000Z', finished_at: null, created_at: '2026-10-28T09:00:00.000Z' }
const serverSet = { id: 'set-1', user_id: 'u1', workout_id: 'srv', exercise_key: 'bench', set_index: 0, weight_kg: 50, reps: 10, created_at: '2026-10-28T09:05:00.000Z' }

describe('lokale Änderungen am offenen Training', () => {
  it('zeigt ein offline begonnenes Training mit seinen Sätzen', () => {
    const view = applyPendingToOpenWorkout(null, entries(start('w1'), set('w1', 0), set('w1', 1)), input)
    expect(view?.workout.id).toBe('w1')
    expect(view?.sets.map((s) => s.set_index)).toEqual([0, 1])
  })

  it('legt lokale Sätze über die Sätze vom Server und berücksichtigt geöffnete Sätze', () => {
    const ops = entries(set('srv', 0, 55), set('srv', 1), { kind: 'set.delete', workoutId: 'srv', exerciseKey: 'bench', setIndex: 1 })
    const view = applyPendingToOpenWorkout({ workout: serverWorkout, sets: [serverSet] }, ops, input)
    expect(view?.sets).toHaveLength(1)
    expect(view?.sets[0]).toMatchObject({ id: 'set-1', weight_kg: 55 })
  })

  it('gilt nach lokalem Abschließen oder Verwerfen nicht mehr als offen', () => {
    expect(applyPendingToOpenWorkout(null, entries(start('w1'), { kind: 'workout.finish', id: 'w1', finishedAt: '2026-10-28T11:00:00.000Z' }), input)).toBeNull()
    expect(applyPendingToOpenWorkout({ workout: serverWorkout, sets: [] }, entries({ kind: 'workout.delete', id: 'srv' }), input)).toBeNull()
  })

  it('ignoriert Trainings anderer Tage und solche außerhalb des Fensters', () => {
    const other: OutboxOp = { kind: 'workout.start', id: 'w2', planDayId: 'd2', startedAt: '2026-10-28T10:00:00.000Z' }
    expect(applyPendingToOpenWorkout(null, entries(other, start('alt', '2026-10-27T10:00:00.000Z')), input)).toBeNull()
  })

  it('nimmt bei mehreren offenen das jüngste', () => {
    const view = applyPendingToOpenWorkout({ workout: serverWorkout, sets: [serverSet] }, entries(start('w1')), input)
    expect(view?.workout.id).toBe('w1')
    expect(view?.sets).toEqual([])
  })
})

describe('Vorschlag nach offline abgeschlossenem Training', () => {
  const server = new Map([['bench', [{ weightKg: 50, reps: 10 }]], ['squat', [{ weightKg: 80, reps: 5 }]]])

  it('nutzt die Sätze des lokal abgeschlossenen Trainings vor dem Serverstand', () => {
    const ops = entries(start('w1'), set('w1', 1, 62.5), set('w1', 0, 60), { kind: 'workout.finish', id: 'w1', finishedAt: '2026-10-28T11:00:00.000Z' })
    const result = applyPendingToLastSets(server, ops, ['bench', 'squat'])
    expect(result.get('bench')).toEqual([{ weightKg: 60, reps: 8 }, { weightKg: 62.5, reps: 8 }])
    expect(result.get('squat')).toEqual([{ weightKg: 80, reps: 5 }])
  })

  it('lässt den Serverstand ohne lokal abgeschlossenes Training unverändert', () => {
    expect(applyPendingToLastSets(server, entries(start('w1'), set('w1', 0)), ['bench'])).toBe(server)
  })
})

describe('Trainingstage aus der Warteschlange', () => {
  it('liefert Beginn-Zeitpunkte nicht verworfener Trainings', () => {
    expect(pendingTrainingStarts(entries(start('w1'), start('w2', '2026-10-27T18:00:00.000Z'), { kind: 'workout.delete', id: 'w2' }))).toEqual(['2026-10-28T10:00:00.000Z'])
  })
})

describe('Fortsetzungsfenster und bereits übertragener Beginn', () => {
  it('zeigt ein Training aus dem Vorrat außerhalb des Fensters nicht mehr als offen', () => {
    const old = { ...serverWorkout, started_at: '2026-10-26T09:00:00.000Z' }
    expect(applyPendingToOpenWorkout({ workout: old, sets: [serverSet] }, [], input)).toBeNull()
  })

  it('nutzt auch ein Training, dessen Beginn schon übertragen ist und nur das Abschließen wartet', () => {
    const server = new Map([['bench', [{ weightKg: 50, reps: 10 }]]])
    const ops = entries(set('srv', 1, 57.5), { kind: 'workout.finish', id: 'srv', finishedAt: '2026-10-28T11:00:00.000Z' })
    const result = applyPendingToLastSets(server, ops, ['bench'], [{ workout: serverWorkout, sets: [serverSet] }])
    expect(result.get('bench')).toEqual([{ weightKg: 50, reps: 10 }, { weightKg: 57.5, reps: 8 }])
  })
})

describe('betroffene Trainings', () => {
  it('sammelt Trainings aus wartenden und abgelehnten Einträgen, ungültige zählen nicht', () => {
    const ops = [start('w1'), set('w2', 0), { kind: 'workout.delete', id: 'w3' } as const, { kind: 'food.delete', id: 'f1' } as const, null]
    expect(referencedWorkoutIds(ops)).toEqual(new Set(['w1', 'w2', 'w3']))
  })
})
