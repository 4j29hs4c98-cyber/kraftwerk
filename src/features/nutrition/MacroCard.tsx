import { Card } from '../../components/Card'
import { ErrorState, LoadingState } from '../../components/States'
import type { AsyncState } from '../../lib/useAsync'
import type { FoodEntry } from './api'
import { macroTargets, type NutritionTarget } from './calc'
import { sumFood } from './foodInput'
import { ProgressBar } from './ProgressBar'

interface Props {
  readonly target: AsyncState<NutritionTarget | null> & { readonly reload: () => void }
  readonly entries: readonly FoodEntry[]
}

/** Tagesbalken für Kalorien, Eiweiß, Kohlenhydrate und Fett. */
export function MacroCard({ target, entries }: Props) {
  const totals = sumFood(entries)
  return (
    <Card className="mb-4">
      {target.status === 'loading' && <LoadingState label="Bedarf wird berechnet" />}
      {target.status === 'error' && <ErrorState message={target.message} onRetry={target.reload} />}
      {target.status === 'ready' && !target.data && (
        <p className="text-sm text-muted">
          Für dein Tagesziel brauchen wir Geschlecht, Geburtsjahr, Größe und ein aktuelles Gewicht. Ergänze sie im Profil und unter Fortschritt.
        </p>
      )}
      {target.status === 'ready' && target.data && <Bars target={target.data} totals={totals} />}
    </Card>
  )
}

function Bars({ target, totals }: { readonly target: NutritionTarget; readonly totals: ReturnType<typeof sumFood> }) {
  const macros = macroTargets(target.kcal, target.proteinG)
  return (
    <div className="flex flex-col gap-5">
      <ProgressBar label="Kalorien" value={totals.kcal} target={target.kcal} unit="kcal" />
      <ProgressBar label="Eiweiß" value={totals.proteinG} target={macros.proteinG} unit="g" />
      <div className="grid gap-5 sm:grid-cols-2">
        <ProgressBar label="Kohlenhydrate" value={totals.carbsG} target={macros.carbsG} unit="g" />
        <ProgressBar label="Fett" value={totals.fatG} target={macros.fatG} unit="g" />
      </div>
      <p className="text-xs text-muted">
        Grundumsatz {target.bmr} kcal, Gesamtbedarf {target.tdee} kcal (Faktor {String(target.activityFactor).replace('.', ',')}). Fett deckt 25 % der Kalorien,
        Kohlenhydrate den Rest. Das Ziel ist ein Richtwert, kein medizinischer Rat.
      </p>
    </div>
  )
}
