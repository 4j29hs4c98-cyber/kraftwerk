// Dieses Modul zieht barcode-detector und die Wasm-Adresse mit. Es wird nur per import() geladen, wenn der Scanner öffnet.
import { BarcodeDetector as PonyfillDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

/** Produktcodes aus Lebensmittelläden. UPC-E fehlt bewusst: Open Food Facts findet dazu praktisch nichts. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const

export interface CodeDetector {
  /** Rohwerte der Codes, die im Bild erkannt wurden. */
  readonly detect: (source: HTMLVideoElement) => Promise<readonly string[]>
}

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<readonly { readonly rawValue: string }[]>
}
interface DetectorClass {
  new (options: { formats: readonly string[] }): DetectorLike
}
interface NativeDetectorClass extends DetectorClass {
  getSupportedFormats(): Promise<readonly string[]>
}

// Das Wasm liegt im eigenen Build, nicht auf dem Standard-CDN (jsDelivr). So läuft es auch als PWA ohne Netz.
prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  fireImmediately: false,
})

/** Der eingebaute Detektor (Chrome auf Android), wenn er alle Formate kann; sonst der Zxing-Ersatz für iOS Safari. */
async function pickDetectorClass(): Promise<DetectorClass> {
  const native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (native) {
    try {
      const supported = await native.getSupportedFormats()
      if (FORMATS.every((format) => supported.includes(format))) return native
    } catch {
      // Fällt auf den Ersatz zurück.
    }
  }
  return PonyfillDetector as unknown as DetectorClass
}

export async function createCodeDetector(): Promise<CodeDetector> {
  const Detector = await pickDetectorClass()
  const detector = new Detector({ formats: FORMATS })
  return { detect: async (source) => (await detector.detect(source)).map((code) => code.rawValue) }
}
