import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { Logo } from '../../components/Logo'
import { InlineError } from '../../components/States'
import { toMessage } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { parseNumber, validateBody } from '../profile/body'
import { DAYS_HINT, DaysPicker, EquipmentPicker, GoalPicker, LevelPicker, LocationPicker, SexPicker } from '../profile/pickers'
import { useProfile } from '../profile/ProfileProvider'
import { ALL_EQUIPMENT, type Equipment, type Goal, type Level, type Location, type Sex } from '../profile/types'
import { completeOnboarding } from './api'

interface Answers {
  readonly goal: Goal | null
  readonly level: Level | null
  readonly daysPerWeek: number | null
  readonly location: Location | null
  readonly equipment: readonly Equipment[]
  readonly sex: Sex | null
  readonly displayName: string
  readonly birthYear: string
  readonly heightCm: string
  readonly weightKg: string
}

const INITIAL: Answers = {
  goal: null,
  level: null,
  daysPerWeek: null,
  location: null,
  equipment: [],
  sex: null,
  displayName: '',
  birthYear: '',
  heightCm: '',
  weightKg: '',
}

interface Step {
  readonly title: string
  readonly lead: string
  readonly isComplete: (a: Answers) => boolean
}

const STEPS: readonly Step[] = [
  { title: 'Was ist dein Ziel?', lead: 'Danach richten sich Sätze, Wiederholungen und dein Kalorienziel.', isComplete: (a) => a.goal !== null },
  { title: 'Wie viel Erfahrung hast du?', lead: 'Sei ehrlich, der Plan wächst mit dir.', isComplete: (a) => a.level !== null },
  { title: 'Wie oft willst du trainieren?', lead: 'Tage pro Woche. Lieber realistisch als ehrgeizig.', isComplete: (a) => a.daysPerWeek !== null },
  { title: 'Wo trainierst du?', lead: 'Damit nur Übungen im Plan landen, die du auch machen kannst.', isComplete: (a) => a.location !== null },
  { title: 'Welche Ausrüstung hast du?', lead: 'Mehrfachauswahl. Ohne Auswahl bekommst du einen Plan mit Körpergewichtsübungen.', isComplete: () => true },
  { title: 'Ein paar Eckdaten', lead: 'Für deinen Kalorienbedarf und deine Gewichtskurve.', isComplete: (a) => a.sex !== null },
]

export function OnboardingPage() {
  const { session } = useAuth()
  const { setProfile } = useProfile()
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>(INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const step = STEPS[stepIndex] ?? STEPS[0]!
  const isLast = stepIndex === STEPS.length - 1
  const update = (patch: Partial<Answers>) => setAnswers((prev) => ({ ...prev, ...patch }))

  const chooseLocation = (location: Location) =>
    update({ location, equipment: location === 'gym' ? ALL_EQUIPMENT : answers.location === 'gym' ? [] : answers.equipment })

  async function finish() {
    const { goal, level, daysPerWeek, location, sex } = answers
    if (!session || !goal || !level || daysPerWeek === null || !location || !sex) return setError('Bitte beantworte alle Fragen.')
    const invalid = validateBody(answers, new Date())
    if (invalid) return setError(invalid)
    setError(null)
    setSaving(true)
    try {
      const profile = await completeOnboarding(session.user.id, {
        displayName: answers.displayName.trim(),
        goal,
        level,
        daysPerWeek,
        location,
        equipment: answers.equipment,
        sex,
        birthYear: parseNumber(answers.birthYear) ?? 0,
        heightCm: Math.round(parseNumber(answers.heightCm) ?? 0),
        weightKg: parseNumber(answers.weightKg) ?? 0,
      })
      setProfile(profile)
      navigate('/heute', { replace: true })
    } catch (err) {
      setError(toMessage(err, 'Dein Plan konnte nicht gespeichert werden. Bitte versuche es noch einmal.'))
      setSaving(false)
    }
  }

  function next() {
    if (!step.isComplete(answers)) return setError('Bitte triff eine Auswahl.')
    setError(null)
    if (isLast) void finish()
    else setStepIndex((i) => i + 1)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="text-sm text-muted">
          Schritt {stepIndex + 1} von {STEPS.length}
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
      </div>

      <section className="flex-1 pt-8">
        <h1 className="font-display text-4xl font-bold uppercase leading-none">{step.title}</h1>
        <p className="mt-2 text-muted">{step.lead}</p>
        <div className="mt-6">
          {stepIndex === 0 && <GoalPicker value={answers.goal} onChange={(goal) => update({ goal })} />}
          {stepIndex === 1 && <LevelPicker value={answers.level} onChange={(level) => update({ level })} />}
          {stepIndex === 2 && (
            <>
              <DaysPicker value={answers.daysPerWeek} onChange={(daysPerWeek) => update({ daysPerWeek })} />
              {answers.daysPerWeek !== null && <p className="mt-4 text-sm text-muted">{DAYS_HINT[answers.daysPerWeek]}</p>}
            </>
          )}
          {stepIndex === 3 && <LocationPicker value={answers.location} onChange={chooseLocation} />}
          {stepIndex === 4 && <EquipmentPicker value={answers.equipment} onChange={(equipment) => update({ equipment })} />}
          {stepIndex === 5 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-1.5 text-sm font-medium text-muted">Geschlecht</p>
                <SexPicker value={answers.sex} onChange={(sex) => update({ sex })} />
              </div>
              <Field label="Wie dürfen wir dich nennen? (optional)" autoComplete="given-name" value={answers.displayName} onChange={(e) => update({ displayName: e.target.value })} maxLength={40} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Geburtsjahr" inputMode="numeric" placeholder="2000" value={answers.birthYear} onChange={(e) => update({ birthYear: e.target.value })} />
                <Field label="Größe" inputMode="numeric" suffix="cm" placeholder="178" value={answers.heightCm} onChange={(e) => update({ heightCm: e.target.value })} />
              </div>
              <Field label="Aktuelles Gewicht" inputMode="decimal" suffix="kg" placeholder="75,5" value={answers.weightKg} onChange={(e) => update({ weightKg: e.target.value })} />
            </div>
          )}
        </div>
      </section>

      <div className="pb-safe sticky bottom-0 mt-8 flex flex-col gap-3 bg-bg pt-3">
        <InlineError message={error} />
        <div className="flex gap-3">
          {stepIndex > 0 && (
            <Button variant="secondary" onClick={() => setStepIndex((i) => i - 1)} disabled={saving}>
              Zurück
            </Button>
          )}
          <Button className="flex-1" onClick={next} loading={saving}>
            {isLast ? (saving ? 'Plan wird erstellt' : 'Plan erstellen') : 'Weiter'}
          </Button>
        </div>
      </div>
    </main>
  )
}
