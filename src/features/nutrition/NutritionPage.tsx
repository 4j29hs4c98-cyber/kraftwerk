import { useState } from 'react'
import { fetchActivePlan } from '../plan/api'
import { IconChevron } from '../../app/icons'
import { Button } from '../../components/Button'
import { Card, PageHeader, SectionTitle } from '../../components/Card'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { addDays, formatLongDate, parseISODate, startOfWeek, toISODate } from '../../lib/date'
import { toMessage } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'
import { useToday } from '../../lib/useToday'
import { useProfile } from '../profile/ProfileProvider'
import { toBodyProfile, toTrainingProfile } from '../profile/types'
import { fetchLatestBodyWeight } from '../progress/api'
import {
  addFoodEntry,
  deleteFoodEntry,
  fetchActiveMealPlan,
  fetchFoodEntries,
  fetchPlanEntries,
  fetchTrainingDays,
  updateFoodEntry,
  type FoodEntry,
  type FoodValues,
  type PlannedMeal,
} from './api'
import { ageFromBirthYear, calculateTarget, type NutritionTarget } from './calc'
import { EntryList } from './EntryList'
import { createFood, fetchFoods } from './foods/api'
import { BUILTIN_FOODS } from './foods/builtin'
import { mergeFoods } from './foods/foodMath'
import { FreeEntry } from './foods/FreeEntry'
import { MyFoodsPanel } from './foods/MyFoodsPanel'
import { MacroCard } from './MacroCard'
import { daysOfWeekUntil, weekAdherence } from './mealPlan/adherence'
import { MealImportPanel } from './mealPlan/MealImportPanel'
import { MealPlanEditor } from './mealPlan/MealPlanEditor'
import { itemsForDay, type MealSlot } from './mealPlan/model'
import { loadVariantChoices, saveVariantChoices, withVariantChoice, type VariantChoices } from './mealPlan/variantChoice'
import { PlannedMeals } from './PlannedMeals'
import { defaultTrainingDay, loadOverrides, saveOverrides, type TrainingOverrides } from './trainingDay'
import { TrainingDayToggle } from './TrainingDayToggle'

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
  const label = day === today ? 'Heute' : day === toISODate(addDays(parseISODate(today), -1)) ? 'Gestern' : formatLongDate(date)
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

/** Wandelt Fehler in Meldungen, die die Formulare direkt anzeigen können. */
async function withMessage(action: () => Promise<unknown>, fallback: string): Promise<void> {
  try {
    await action()
  } catch (err) {
    throw new Error(toMessage(err, fallback))
  }
}

type Mode = 'view' | 'edit' | 'import' | 'foods'

export function NutritionPage() {
  const [day, setDay] = useState(() => toISODate(new Date()))
  // Stand die Ansicht auf "Heute" und der Tag wechselt, springt sie mit.
  const today = useToday((previous, next) => setDay((current) => (current === previous ? next : current)))
  const [mode, setMode] = useState<Mode>('view')
  /** Manuell gesetzter Trainings- oder Ruhetag je Datum (im Browser gemerkt); sonst gilt der Standard aus Training und Wochenplan. */
  const [trainingOverride, setTrainingOverride] = useState<TrainingOverrides>(loadOverrides)
  /** Gewählte Gericht-Variante je Datum und Mahlzeit (im Browser gemerkt). */
  const [variantChoices, setVariantChoices] = useState<VariantChoices>(loadVariantChoices)
  const target = useTarget()
  const ownFoods = useAsync(fetchFoods, [])
  const entries = useAsync(() => fetchFoodEntries(day), [day])
  const mealPlan = useAsync(fetchActiveMealPlan, [])
  // Der Trainingsplan liefert nur den Standard für den Schalter; fehlt er, gilt das bisherige Verhalten.
  const trainingPlan = useAsync(fetchActivePlan, [])
  const planDays = trainingPlan.status === 'ready' ? (trainingPlan.data?.days ?? []) : []
  const dayTraining = useAsync(() => {
    const start = parseISODate(day)
    return fetchTrainingDays(start, addDays(start, 1))
  }, [day])
  const week = useAsync(async () => {
    const todayDate = parseISODate(today)
    const monday = startOfWeek(todayDate)
    const [trainingDays, planEntries] = await Promise.all([fetchTrainingDays(monday, addDays(todayDate, 1)), fetchPlanEntries(toISODate(monday), today)])
    return { trainingDays, planEntries }
  }, [today])

  const list: readonly FoodEntry[] = entries.status === 'ready' ? entries.data : []
  const plan = mealPlan.status === 'ready' ? mealPlan.data : null
  const own = ownFoods.status === 'ready' ? ownFoods.data : []
  const foods = mergeFoods(own, BUILTIN_FOODS)
  const targetKcal = target.status === 'ready' && target.data ? target.data.kcal : null
  const dayDefault = defaultTrainingDay(parseISODate(day), dayTraining.status === 'ready' && dayTraining.data.has(day), planDays)
  const isTrainingDay = trainingOverride[day] ?? dayDefault.isTrainingDay
  const todaysItems: readonly PlannedMeal[] = plan ? itemsForDay(plan.items, parseISODate(day), isTrainingDay) : []
  const shownIds = new Set(todaysItems.map((i) => i.id))
  const otherEntries = list.filter((e) => e.meal_plan_item_id === null || !shownIds.has(e.meal_plan_item_id))

  const adherence =
    plan && week.status === 'ready'
      ? weekAdherence(
          plan.items,
          daysOfWeekUntil(parseISODate(today)).map((date) => {
            const iso = toISODate(date)
            return { date, isTrainingDay: trainingOverride[iso] ?? defaultTrainingDay(date, week.data.trainingDays.has(iso), planDays).isTrainingDay }
          }),
          week.data.planEntries,
        )
      : null

  function refresh() {
    entries.reload()
    week.reload()
  }

  /** Hakt Plan-Einträge nacheinander ab (bei Varianten alle Zutaten); schon eingetragene werden übersprungen. */
  const addPlanned = (items: readonly PlannedMeal[]) =>
    withMessage(async () => {
      const missing = items.filter((item) => !list.some((e) => e.meal_plan_item_id === item.id))
      try {
        for (const item of missing) {
          await addFoodEntry({
            eatenOn: day,
            name: item.name,
            kcal: item.kcal ?? 0,
            proteinG: item.proteinG ?? 0,
            carbsG: item.carbsG,
            fatG: item.fatG,
            mealSlot: item.mealSlot,
            mealPlanItemId: item.id,
            status: 'wie_geplant',
          })
        }
      } finally {
        refresh()
      }
    }, 'Die Mahlzeit konnte nicht eingetragen werden.')

  const addReplacement = (item: PlannedMeal, values: FoodValues) =>
    withMessage(async () => {
      await addFoodEntry({ eatenOn: day, ...values, mealSlot: item.mealSlot, mealPlanItemId: item.id, status: 'ersetzt' })
      refresh()
    }, 'Der Eintrag konnte nicht gespeichert werden.')

  const addFree = (values: FoodValues, grams: number | null) =>
    withMessage(async () => {
      await addFoodEntry({ eatenOn: day, ...values, grams, mealSlot: null, mealPlanItemId: null, status: 'frei' })
      refresh()
    }, 'Der Eintrag konnte nicht gespeichert werden.')

  const saveOwnFood = (food: Parameters<typeof createFood>[0]) =>
    withMessage(async () => {
      await createFood(food)
      ownFoods.reload()
    }, 'Das Lebensmittel konnte nicht gespeichert werden.')

  function chooseVariant(slot: MealSlot, name: string) {
    const next = withVariantChoice(variantChoices, day, slot, name, today)
    setVariantChoices(next)
    saveVariantChoices(next)
  }

  const edit = (entry: FoodEntry, values: FoodValues) =>
    withMessage(async () => {
      await updateFoodEntry(entry.id, values)
      refresh()
    }, 'Der Eintrag konnte nicht gespeichert werden.')

  const remove = (entry: FoodEntry) =>
    withMessage(async () => {
      await deleteFoodEntry(entry.id)
      refresh()
    }, 'Der Eintrag konnte nicht gelöscht werden.')

  const removeMany = (toRemove: readonly FoodEntry[]) =>
    withMessage(async () => {
      try {
        for (const entry of toRemove) await deleteFoodEntry(entry.id)
      } finally {
        refresh()
      }
    }, 'Der Eintrag konnte nicht gelöscht werden.')

  function planChanged() {
    setMode('view')
    mealPlan.reload()
    week.reload()
  }

  if (mode === 'foods') {
    return (
      <>
        <PageHeader eyebrow="Nährwerte pro 100 g" title="Ernährung" />
        {ownFoods.status === 'loading' && <LoadingState label="Lebensmittel werden geladen" />}
        {ownFoods.status === 'error' && <ErrorState message={ownFoods.message} onRetry={ownFoods.reload} />}
        {ownFoods.status === 'ready' && <MyFoodsPanel own={ownFoods.data} onChanged={ownFoods.reload} onClose={() => setMode('view')} />}
      </>
    )
  }

  if ((mode === 'edit' || mode === 'import') && mealPlan.status === 'ready') {
    return (
      <>
        <PageHeader eyebrow="Dein Ernährungsplan" title="Ernährung" />
        {mode === 'import' ? (
          <MealImportPanel hasPlan={plan !== null} onImported={planChanged} onCancel={() => setMode('view')} />
        ) : (
          <MealPlanEditor current={plan} onSaved={planChanged} onCancel={() => setMode('view')} />
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Kalorien und Makros" title="Ernährung" />
      <DaySwitcher day={day} today={today} onChange={setDay} />

      <MacroCard target={target} entries={list} />

      {adherence && adherence.planned > 0 && (
        <p className="mb-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <span className="text-muted">Plan eingehalten diese Woche: </span>
          <span className="font-semibold tabular-nums">
            {adherence.done} von {adherence.planned} Mahlzeiten
          </span>
        </p>
      )}

      <div className="mt-6">
        <SectionTitle
          action={
            plan && (
              <div className="flex gap-1">
                <button type="button" onClick={() => setMode('edit')} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-surface-2">
                  Bearbeiten
                </button>
                <button type="button" onClick={() => setMode('import')} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                  Importieren
                </button>
              </div>
            )
          }
        >
          Ernährungsplan
        </SectionTitle>
      </div>
      {mealPlan.status === 'loading' && <LoadingState label="Ernährungsplan wird geladen" />}
      {mealPlan.status === 'error' && <ErrorState message={mealPlan.message} onRetry={mealPlan.reload} />}
      {mealPlan.status === 'ready' && !plan && (
        <EmptyState
          title="Noch kein Ernährungsplan"
          action={
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={() => setMode('import')}>Aus Excel importieren</Button>
              <Button variant="secondary" onClick={() => setMode('edit')}>
                Selbst anlegen
              </Button>
            </div>
          }
        >
          Lege fest, was du an Trainings- und Ruhetagen isst, und hake es hier ab.
        </EmptyState>
      )}
      {plan && (
        <>
          <TrainingDayToggle
            value={isTrainingDay}
            hint={dayTraining.status === 'ready' ? dayDefault.reason : null}
            onChange={(value) => {
              const next = { ...trainingOverride, [day]: value }
              setTrainingOverride(next)
              saveOverrides(next, today)
            }}
          />
          {todaysItems.length === 0 ? (
            <EmptyState title="Für diesen Tag ist nichts geplant">Dein Plan enthält keine Mahlzeiten für diesen Wochentag.</EmptyState>
          ) : (
            entries.status === 'ready' && (
              <PlannedMeals
                items={todaysItems}
                entries={list}
                targetKcal={targetKcal}
                choices={variantChoices[day] ?? {}}
                onChoose={chooseVariant}
                onPlanned={addPlanned}
                onReplace={addReplacement}
                onEdit={edit}
                onUndo={removeMany}
              />
            )
          )}
        </>
      )}

      <Card className="mt-6 mb-4">
        <SectionTitle
          action={
            <button type="button" onClick={() => setMode('foods')} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-surface-2">
              Meine Lebensmittel{own.length > 0 ? ` (${own.length})` : ''}
            </button>
          }
        >
          Freien Eintrag hinzufügen
        </SectionTitle>
        <FreeEntry foods={foods} onAdd={addFree} onSaveFood={saveOwnFood} />
        {ownFoods.status === 'error' && <p className="mt-2 text-xs text-muted">Eigene Lebensmittel konnten nicht geladen werden, die Grundliste steht trotzdem bereit.</p>}
      </Card>

      <SectionTitle>Weitere Einträge</SectionTitle>
      {entries.status === 'loading' && <LoadingState label="Einträge werden geladen" />}
      {entries.status === 'error' && <ErrorState message={entries.message} onRetry={entries.reload} />}
      {entries.status === 'ready' && otherEntries.length === 0 && <EmptyState title="Keine weiteren Einträge">Alles, was nicht im Plan steht, trägst du oben frei ein.</EmptyState>}
      {otherEntries.length > 0 && <EntryList entries={otherEntries} onEdit={edit} onDelete={remove} />}
    </>
  )
}
