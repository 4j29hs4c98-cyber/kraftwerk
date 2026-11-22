import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../../../components/Button'
import { Field } from '../../../../components/Field'
import { normalizeBarcode } from '../barcode'
import { cameraErrorMessage, NO_CAMERA_API, SCANNER_LOAD_FAILED } from './cameraError'

interface Props {
  readonly onDetected: (code: string) => void
  readonly onCancel: () => void
}

const SCAN_INTERVAL_MS = 200

/**
 * Vollbild-Kamera zum Scannen eines Produktcodes. Der Scanner (Zxing, Wasm) wird erst hier nachgeladen.
 * Ohne Kamera oder Berechtigung bleibt die Eingabe von Hand. Beim Schließen werden alle Kamera-Tracks gestoppt.
 */
export function ScannerView({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onDetectedRef = useRef(onDetected)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const stop = () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return setCameraError(NO_CAMERA_API)
      // Scanner und Kamera laden gleichzeitig.
      const detectorPromise = import('./detector').then((module) => module.createCodeDetector())
      detectorPromise.catch(() => undefined)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } })
      } catch (err) {
        return setCameraError(cameraErrorMessage(err))
      }
      const video = videoRef.current
      if (stopped || !video) return stop()
      video.srcObject = stream
      await video.play().catch(() => undefined)
      let detector: Awaited<typeof detectorPromise>
      try {
        detector = await detectorPromise
      } catch {
        stop()
        return setCameraError(SCANNER_LOAD_FAILED)
      }
      if (stopped) return
      setReady(true)

      const tick = async () => {
        if (stopped) return
        try {
          const code = (await detector.detect(video)).map(normalizeBarcode).find((c) => c !== null)
          if (code && !stopped) {
            stop()
            onDetectedRef.current(code)
            return
          }
        } catch {
          // Einzelbild nicht lesbar (Video noch nicht bereit): nächster Versuch.
        }
        if (!stopped) timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS)
      }
      void tick()
    }

    void start()
    return stop
  }, [])

  // Fokus in den Dialog und Hintergrund nicht mitscrollen lassen, solange er offen ist.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('button[type="button"]')?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function submitManual(event: FormEvent) {
    event.preventDefault()
    const code = normalizeBarcode(manual)
    if (!code) return setManualError('Bitte gib 8 bis 14 Ziffern ein, nur Zahlen.')
    onDetected(code)
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Produktcode scannen" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} playsInline muted autoPlay className="size-full object-cover" aria-hidden="true" />
        {ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/4 w-4/5 max-w-sm rounded-2xl border-2 border-white/80" />
          </div>
        )}
        <div className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-2 text-sm">
          <p role="status" className={cameraError ? 'sr-only' : 'rounded-xl bg-black/70 px-4 py-3'}>
            {cameraError ? '' : ready ? 'Halte den Strichcode in den Rahmen.' : 'Kamera wird gestartet ...'}
          </p>
          {cameraError && (
            <p role="alert" className="rounded-xl bg-black/70 px-4 py-3">
              {cameraError}
            </p>
          )}
        </div>
      </div>
      <form onSubmit={submitManual} noValidate className="flex flex-col gap-3 bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink">
        <Field
          label="Code von Hand eingeben"
          inputMode="numeric"
          autoComplete="off"
          placeholder="z. B. 4000417025005"
          value={manual}
          maxLength={20}
          onChange={(e) => {
            setManual(e.target.value)
            setManualError(null)
          }}
        />
        {manualError && (
          <p role="alert" className="text-sm text-danger">
            {manualError}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" variant="secondary" className="flex-1">
            Code übernehmen
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  )
}
