import { useState } from 'react'
import { IconChevron, IconTrash } from '../../app/icons'
import { Card, PageHeader, SectionTitle } from '../../components/Card'
import { EmptyState, ErrorState, InlineError, LoadingState } from '../../components/States'
import { addDays, formatLongDate, parseISODate, toISODate } from '../../lib/date'
import { toMessage } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'
import { useToday } from '../../lib/useToday'
import { useProfile } from '../profile/ProfileProvider'
import { toBodyProfile, toTrainingProfile } from '../profile/types'
import { fetchLatestBodyWeight } from '../progress/api'
import { addFoodEntry, deleteFoodEntry, fetchFoodEntries, type FoodEntry } from './api'
import { ageFromBirthYear, calculateTarget, type NutritionTarget } from './calc'
import { FoodForm, type FoodInput } from './FoodForm'
import { ProgressBar } from './ProgressBar'

function useTarget(): ReturnType<typeof useAsync<NutritionTarget | null>> {
  const { profile } = useProfile()
  return useAsync(async () => {
    const body = toBodyProfile(profile)
    const training = toTrainingProfile(profile)
    const weight = await fetchLatestBodyWeight()
    if (!body || !training || weight === null) return null
    return calculateTarget({
      sex: body.sex,
      weightKg: weight,
      heightCm: body.heightCm,
      age: ageFromBirthYear(body.birthYear, new Date()),
      daysPerWeek: training.daysPerWeek,
      goal: training.goal,
    })
  }, [profile])
}

function DaySwitcher({ day, today, onChange }: { readonly day: string; readonly today: string; readonly onChange: (day: string) => void }) {
  const date = parseISODate(day)
  const label = day === today ? 'Heute' : day === toISODate(addDays(new Date(), -1)) ? 'Gestern' : formatLongDate(date)
  return (
    <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-1">
      <button type="button" aria-label="Vorheriger Tag" onClick={() => onChange(toISODate(addDays(date, -1)))} className="flex size-12 items-center justify-center rounded-xl hover:bg-surface-2">
        <IconChevron direction="left" className="size-5" />
      </button>
      <span className="font-semibold capitalize">{label}</span>
      <button
        type="button"
        aria-label="Nächster Tag"
        disabled={day >= today}
        onClick={() => onChange(toISODate(addDays(date, 1)))}
        className="flex size-12 items-center justify-center rounded-xl hover:bg-surface-2 disabled:opacity-30"
      >
        <IconChevron className="size-5" />
      </button>
    </div>
  )
}

export function NutritionPage() {
  const [day, setDay] = useState(() => toISODate(new Date()))
  // Stand die Ansicht auf "Heute" und der Tag wechselt, springt sie mit.
  const today = useToday((previous, next) => setDay((current) => (current === previous ? next : current)))
  const target = useTarget()
  const entries = useAsync(() => fetchFoodEntries(day), [day])
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const list: readonly FoodEntry[] = entries.status === 'ready' ? entries.data : []
  const kcal = list.reduce((n, e) => n + (e.kcal ?? 0), 0)
  const protein = list.reduce((n, e) => n + (e.protein_g ?? 0), 0)

  async function add(input: FoodInput) {
    try {
      await addFoodEntry({ eatenOn: day, ...input })
      entries.reload()
    } catch (err) {
      throw new Error(toMessage(err, 'Der Eintrag konnte nicht gespeichert werden.'))
    }
  }

  async function remove(id: string) {
    setDeleting(id)
    setDeleteError(null)
    try {
      await deleteFoodEntry(id)
      entries.reload()
    } catch (err) {
      setDeleteError(toMessage(err, 'Der Eintrag konnte nicht gelöscht werden.'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Kalorien und Eiweiß" title="Ernährung" />
      <DaySwitcher day={day} today={today} onChange={setDay} />

      <Card className="mb-4">
        {target.status === 'loading' && <LoadingState label="Bedarf wird berechnet" />}
        {target.status === 'error' && <ErrorState message={target.message} onRetry={target.reload} />}
        {target.status === 'ready' && !target.data && (
          <p className="text-sm text-muted">Für dein Tagesziel brauchen wir Geschlecht, Geburtsjahr, Größe und ein aktuelles Gewicht. Ergänze sie im Profil und unter Fortschritt.</p>
        )}
        {target.status === 'ready' && target.data && (
          <div className="flex flex-col gap-5">
            <ProgressBar label="Kalorien" value={kcal} target={target.data.kcal} unit="kcal" />
            <ProgressBar label="Eiweiß" value={Math.round(protein * 10) / 10} target={target.data.proteinG} unit="g" />
            <p className="text-xs text-muted">
              Grundumsatz {target.data.bmr} kcal, Gesamtbedarf {target.data.tdee} kcal (Faktor {String(target.data.activityFactor).replace('.', ',')}). Das Ziel ist ein
              Richtwert, kein medizinischer Rat.
            </p>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle>Eintrag hinzufügen</SectionTitle>
        <FoodForm onAdd={add} />
      </Card>

      <SectionTitle>Einträge</SectionTitle>
      <InlineError message={deleteError} />
      {entries.status === 'loading' && <LoadingState label="Einträge werden geladen" />}
      {entries.status === 'error' && <ErrorState message={entries.message} onRetry={entries.reload} />}
      {entries.status === 'ready' && list.length === 0 && <EmptyState title="Noch nichts eingetragen">Füge oben deine erste Mahlzeit für diesen Tag hinzu.</EmptyState>}
      {list.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.name}</p>
                <p className="text-sm text-muted tabular-nums">
                  {e.kcal ?? 0} kcal · {String(e.protein_g ?? 0).replace('.', ',')} g Eiweiß
                </p>
              </div>
              <button
                type="button"
                aria-label={`${e.name} löschen`}
                disabled={deleting === e.id}
                onClick={() => void remove(e.id)}
                className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
              >
                <IconTrash className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
