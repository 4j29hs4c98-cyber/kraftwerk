import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Card, PageHeader, SectionTitle } from '../../components/Card'
import { Field } from '../../components/Field'
import { InlineError } from '../../components/States'
import { syncEngine } from '../../lib/offline'
import { toMessage } from '../../lib/supabase'
import { signOut } from '../auth/api'
import { useAuth } from '../auth/AuthProvider'
import { regeneratePlan } from '../plan/regenerate'
import { updateProfile } from './api'
import { parseNumber, validateBody } from './body'
import { DAYS_HINT, DaysPicker, EquipmentPicker, GoalPicker, LevelPicker, LocationPicker, SexPicker } from './pickers'
import { useProfile } from './ProfileProvider'
import { ALL_EQUIPMENT, GOALS, LEVELS, LOCATIONS, parseEquipment, SEXES, type Equipment, type Goal, type Level, type Location, type Sex } from './types'

const pick = <T extends string>(values: readonly T[], v: string | null): T | null => (values as readonly string[]).includes(v ?? '') ? (v as T) : null

type Notice = { readonly kind: 'ok' | 'error'; readonly text: string } | null

function NoticeLine({ notice }: { readonly notice: Notice }) {
  if (!notice) return null
  if (notice.kind === 'error') return <InlineError message={notice.text} />
  return <p role="status" className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">{notice.text}</p>
}

function AboutCard() {
  const { profile, setProfile } = useProfile()
  const [name, setName] = useState(profile.display_name ?? '')
  const [sex, setSex] = useState<Sex | null>(pick(SEXES, profile.sex))
  const [birthYear, setBirthYear] = useState(String(profile.birth_year ?? ''))
  const [height, setHeight] = useState(String(profile.height_cm ?? ''))
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    // Gewicht wird unter Fortschritt gepflegt, daher hier ein gültiger Platzhalter für die Prüfung.
    const invalid = !sex ? 'Bitte wähle ein Geschlecht.' : validateBody({ birthYear, heightCm: height, weightKg: '70' }, new Date())
    if (invalid) return setNotice({ kind: 'error', text: invalid })
    setBusy(true)
    try {
      const updated = await updateProfile(profile.id, {
        display_name: name.trim() || null,
        sex,
        birth_year: parseNumber(birthYear),
        height_cm: Math.round(parseNumber(height) ?? 0),
      })
      setProfile(updated)
      setNotice({ kind: 'ok', text: 'Gespeichert.' })
    } catch (err) {
      setNotice({ kind: 'error', text: toMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <SectionTitle>Über dich</SectionTitle>
      <div className="flex flex-col gap-4">
        <Field label="Name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <SexPicker value={sex} onChange={setSex} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Geburtsjahr" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
          <Field label="Größe" inputMode="numeric" suffix="cm" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
        <NoticeLine notice={notice} />
        <Button variant="secondary" onClick={save} loading={busy}>Speichern</Button>
      </div>
    </Card>
  )
}

function TrainingCard() {
  const { profile, setProfile } = useProfile()
  const [goal, setGoal] = useState<Goal | null>(pick(GOALS, profile.goal))
  const [level, setLevel] = useState<Level | null>(pick(LEVELS, profile.level))
  const [days, setDays] = useState<number | null>(profile.days_per_week)
  const [location, setLocation] = useState<Location | null>(pick(LOCATIONS, profile.location))
  const [equipment, setEquipment] = useState<readonly Equipment[]>(parseEquipment(profile.equipment))
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState<'save' | 'regenerate' | null>(null)

  // Wie im Fragebogen: Studio heißt alle Geräte, der Wechsel nach Zuhause beginnt ohne Geräte.
  function chooseLocation(next: Location) {
    if (next === 'gym') setEquipment(ALL_EQUIPMENT)
    else if (location === 'gym') setEquipment([])
    setLocation(next)
  }

  async function save(withNewPlan: boolean) {
    if (!goal || !level || days === null || !location) return setNotice({ kind: 'error', text: 'Bitte fülle alle Trainingsangaben aus.' })
    setBusy(withNewPlan ? 'regenerate' : 'save')
    setNotice(null)
    try {
      const updated = await updateProfile(profile.id, { goal, level, days_per_week: days, location, equipment: [...equipment] })
      setProfile(updated)
      if (withNewPlan) await regeneratePlan(updated)
      setNotice({ kind: 'ok', text: withNewPlan ? 'Gespeichert. Dein neuer Plan ist aktiv.' : 'Gespeichert. Dein Plan bleibt unverändert.' })
    } catch (err) {
      setNotice({ kind: 'error', text: toMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <SectionTitle>Training</SectionTitle>
      <div className="flex flex-col gap-6">
        <div><p className="mb-2 text-sm font-medium text-muted">Ziel</p><GoalPicker value={goal} onChange={setGoal} /></div>
        <div><p className="mb-2 text-sm font-medium text-muted">Erfahrung</p><LevelPicker value={level} onChange={setLevel} /></div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Trainingstage pro Woche</p>
          <DaysPicker value={days} onChange={setDays} />
          {days !== null && <p className="mt-2 text-xs text-muted">{DAYS_HINT[days]}</p>}
        </div>
        <div><p className="mb-2 text-sm font-medium text-muted">Trainingsort</p><LocationPicker value={location} onChange={chooseLocation} /></div>
        <div><p className="mb-2 text-sm font-medium text-muted">Ausrüstung</p><EquipmentPicker value={equipment} onChange={setEquipment} /></div>
        <NoticeLine notice={notice} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => save(true)} loading={busy === 'regenerate'} disabled={busy !== null}>Speichern und Plan neu erzeugen</Button>
          <Button variant="secondary" onClick={() => save(false)} loading={busy === 'save'} disabled={busy !== null}>Nur speichern</Button>
        </div>
      </div>
    </Card>
  )
}

export function ProfilePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    const { pending } = syncEngine.getSnapshot()
    if (
      pending > 0 &&
      !window.confirm(
        `${pending === 1 ? '1 Eintrag ist' : `${pending} Einträge sind`} noch nicht synchronisiert. Sie bleiben auf diesem Gerät und werden übertragen, wenn du dich hier wieder anmeldest. Trotzdem abmelden?`,
      )
    )
      return
    setBusy(true)
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(toMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow={session?.user.email ?? ''} title="Profil" />
      <div className="flex flex-col gap-4">
        <AboutCard />
        <TrainingCard />
        <Card>
          <SectionTitle>Konto</SectionTitle>
          <InlineError message={error} />
          <Button variant="danger" block onClick={handleSignOut} loading={busy} className="mt-2">Abmelden</Button>
        </Card>
      </div>
    </>
  )
}
