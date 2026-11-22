import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/Button'
import { InlineError } from '../../../components/States'
import type { FoodValues } from '../api'
import { findFoodByBarcode } from './barcode'
import { BarcodeConfirm, type BarcodeCandidate, type BarcodeConfirmed } from './BarcodeConfirm'
import { decimalText, EMPTY_FOOD_DEF, nutrientsFor, toFoodDefForm, type Food, type NewFood } from './foodMath'
import { fetchOffProduct } from './offApi'
import { ScannerView } from './scanner/ScannerView'

interface Props {
  /** Eigene Lebensmittel (und Grundliste); gesucht wird nur unter denen mit Barcode. */
  readonly foods: readonly Food[]
  /** Legt das Lebensmittel mit Barcode an; gibt es den Barcode schon, kommt das vorhandene zurück. */
  readonly onSaveFood: (food: NewFood) => Promise<Food>
  /** Trägt die Menge ein. Fehlt es, wird nur das Lebensmittel angelegt (Seite "Meine Lebensmittel"). */
  readonly onAdd?: (values: FoodValues, grams: number | null) => Promise<void>
}

type Step =
  | { readonly kind: 'idle' }
  | { readonly kind: 'scanning' }
  | { readonly kind: 'lookup'; readonly code: string }
  | { readonly kind: 'failed'; readonly code: string; readonly message: string }
  | { readonly kind: 'confirm'; readonly candidate: BarcodeCandidate }

const IDLE: Step = { kind: 'idle' }

/** Barcode-Eintrag: scannen, im eigenen Bestand oder bei Open Food Facts suchen, bestätigen, speichern und eintragen. */
export function BarcodeEntry({ foods, onSaveFood, onAdd }: Props) {
  const [step, setStep] = useState<Step>(IDLE)
  const [notice, setNotice] = useState<string | null>(null)
  const code = step.kind === 'lookup' ? step.code : null
  const idleRoot = useRef<HTMLDivElement>(null)
  const previousKind = useRef(step.kind)

  // Nach Scanner, Suche oder Bestätigung zurück am Anfang: Fokus auf den Scan-Knopf, damit er nicht ins Leere fällt.
  useEffect(() => {
    if (step.kind === 'idle' && previousKind.current !== 'idle') idleRoot.current?.querySelector('button')?.focus()
    previousKind.current = step.kind
  }, [step.kind])

  useEffect(() => {
    if (code === null) return
    let cancelled = false
    const own = findFoodByBarcode(foods, code)
    if (own) {
      if (onAdd) setStep({ kind: 'confirm', candidate: { barcode: code, existing: own, form: toFoodDefForm(own), servingGrams: null, notes: [] } })
      else {
        setNotice(`${own.name} ist schon in deinen Lebensmitteln.`)
        setStep(IDLE)
      }
      return
    }
    void fetchOffProduct(code).then((result) => {
      if (cancelled) return
      if (!result.ok) return setStep({ kind: 'failed', code, message: result.error })
      const { product } = result
      const form = toFoodDefForm({ ...product, defaultGrams: null })
      setStep({ kind: 'confirm', candidate: { barcode: code, existing: null, form, servingGrams: product.servingGrams, notes: product.notes } })
    })
    return () => {
      cancelled = true
    }
    // foods nur beim Start der Suche lesen: ein späteres Neuladen der Liste darf die Suche nicht neu starten.
  }, [code])

  async function confirm(candidate: BarcodeCandidate, { food, grams }: BarcodeConfirmed) {
    const saved = candidate.existing ?? (await onSaveFood({ ...food, barcode: candidate.barcode }))
    if (onAdd && grams !== null) {
      // Ab jetzt gilt das Lebensmittel als vorhanden: ein erneuter Versuch legt nichts mehr an.
      if (!candidate.existing) setStep({ kind: 'confirm', candidate: { ...candidate, existing: saved, form: toFoodDefForm(saved), notes: [] } })
      const n = nutrientsFor(saved, grams)
      try {
        await onAdd({ name: saved.name, kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG }, grams)
      } catch (err) {
        const reason = err instanceof Error ? ` (${err.message})` : ''
        throw new Error(`${saved.name} ist schon unter "Meine Lebensmittel" gespeichert, nur der Eintrag ist fehlgeschlagen${reason}. Tippe auf Eintragen, um es noch einmal zu versuchen.`)
      }
      setNotice(`${saved.name} (${decimalText(grams)} g) eingetragen.`)
    } else {
      setNotice(`${saved.name} unter "Meine Lebensmittel" gespeichert.`)
    }
    setStep(IDLE)
  }

  if (step.kind === 'scanning') {
    return <ScannerView onCancel={() => setStep(IDLE)} onDetected={(found) => setStep({ kind: 'lookup', code: found })} />
  }

  if (step.kind === 'confirm') {
    return <BarcodeConfirm candidate={step.candidate} canLog={onAdd !== undefined} onSubmit={(confirmed) => confirm(step.candidate, confirmed)} onCancel={() => setStep(IDLE)} />
  }

  if (step.kind === 'lookup') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm text-muted">
        <p role="status" className="flex-1">
          Produkt {step.code} wird gesucht ...
        </p>
        <Button type="button" variant="ghost" autoFocus onClick={() => setStep(IDLE)}>
          Abbrechen
        </Button>
      </div>
    )
  }

  return (
    <div ref={idleRoot} className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setNotice(null)
          setStep({ kind: 'scanning' })
        }}
      >
        Code scannen
      </Button>
      {step.kind === 'failed' && (
        <>
          <InlineError message={step.message} />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep({ kind: 'confirm', candidate: { barcode: step.code, existing: null, form: EMPTY_FOOD_DEF, servingGrams: null, notes: [] } })}
            >
              Selbst eintragen
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(IDLE)}>
              Schließen
            </Button>
          </div>
        </>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">
          {notice}
        </p>
      )}
    </div>
  )
}
