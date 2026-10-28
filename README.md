# Kraftwerk

Fitness-App mit Trainingsplan-Generator, Workout-Log mit doppelter Progression, Ernährungsziel und Fortschrittsansicht.
React, Vite, TypeScript (strict), Tailwind CSS 4, Supabase, React Router.

## Start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run build      # Typprüfung und Produktions-Build
```

`.env.local` braucht `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` (Vorlage: `.env.example`).

## Supabase-Einstellungen

- Im Supabase-Dashboard unter Authentication > URL Configuration die **Site URL auf `http://localhost:5173`** setzen
  (und die spätere Produktions-Adresse zu den Redirect URLs hinzufügen). Sonst führen Bestätigungs-Links ins Leere.
- Ist die E-Mail-Bestätigung aus, liefert die Registrierung sofort eine Session und es geht direkt zum Fragebogen.
  Ist sie an, zeigt die App den Hinweis "Bitte bestätige deine E-Mail".
- Schema: `supabase/migrations/20261027182501_init.sql`, Typen: `src/types/database.ts`.

## Als App aufs iPhone

Kraftwerk ist eine installierbare Web-App (PWA) und läuft danach im Vollbild ohne Safari-Leisten.

1. https://4j29hs4c98-cyber.github.io/kraftwerk/ in **Safari** öffnen (andere Browser können auf iOS nicht installieren).
2. Unten auf **Teilen** tippen (Quadrat mit Pfeil nach oben).
3. **Zum Home-Bildschirm** wählen, Namen "Kraftwerk" bestätigen, **Hinzufügen**.
4. Die App über das neue Symbol auf dem Home-Bildschirm starten und dort einmal anmelden.

Die App-Oberfläche wird zwischengespeichert und startet schnell, Trainingsdaten kommen immer frisch aus Supabase
(Anfragen an `*.supabase.co` werden nie gecacht). Neue Versionen lädt die App selbst: einmal schließen und neu öffnen.

## Veröffentlichung

Gehostet über GitHub Pages unter `https://4j29hs4c98-cyber.github.io/kraftwerk/`.

- Jeder Push auf `main` startet `.github/workflows/deploy.yml`: `npm ci`, `npm test`, `npm run build`, danach Upload und Deployment auf Pages.
- In den Repository-Einstellungen unter **Settings > Secrets and variables > Actions > Variables** zwei Variablen anlegen:
  `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` (der Publishable Key ist öffentlich, deshalb Variablen statt Secrets).
- Unter **Settings > Pages** als Quelle **GitHub Actions** wählen.
- Im Supabase-Dashboard unter Authentication > URL Configuration `https://4j29hs4c98-cyber.github.io/kraftwerk/` zu den Redirect URLs
  hinzufügen (für den Produktivbetrieb auch als Site URL).
- Der Build läuft unter dem Pfad `/kraftwerk/` (`base` in `vite.config.ts`, nur für `vite build`), lokal bleibt es `/`.
  `404.html` ist eine Kopie von `index.html`, damit direkte Aufrufe wie `/kraftwerk/plan` auf GitHub Pages funktionieren.
- Lokal prüfen: `npm run build && npx vite preview --base /kraftwerk/` und http://localhost:4173/kraftwerk/ öffnen.
- Icons neu erzeugen (nach Logo-Änderung): `node scripts/generate-icons.mjs`.

## Struktur

```
src/
  app/            Routing, Schutz-Routen (guards), Layout mit Tab-Leiste, Icons
  components/     Kleine UI-Bausteine (Button, Card, Field, States, ChoiceTile, Logo)
  lib/            Supabase-Client und Fehlertexte, Datums-Helfer, useAsync
  features/
    auth/         Anmelden, Registrieren, Session-Kontext
    onboarding/   Mehrstufiger Fragebogen, erster Plan
    profile/      Profil-Typen, Auswahl-Felder, Einstellungen
    plan/         Übungsbibliothek, Plangenerator (rein, getestet), Plan-Ansicht, Editor (editor/), Excel-Import (import/)
    workout/      Workout-Modus, Progression (rein, getestet), Pausen-Timer
    nutrition/    Kalorien- und Makroziele (rein, getestet), Tagesprotokoll, Ernährungsplan (mealPlan/: Modell, Import, Editor, Planeinhaltung)
    progress/     Kalender, Wochenserie, Kurven (charts/: eigene SVG-Kurven, Rechenlogik getestet), Trainingsverlauf (history/)
    home/         Startseite, Heute-Ansicht mit Pausen-Anzeige (pause.ts, getestet), 404
```

Datenzugriff liegt pro Feature in `api.ts`. Reine Logik (`generator.ts`, `progression.ts`, `session.ts`, `calc.ts`, `streak.ts`, `chartMath.ts`,
`parseMealTable.ts`, `pause.ts` und weitere) hat keine
Abhängigkeit zu React oder Supabase und ist mit Vitest abgedeckt.

## Fachliche Regeln

- **Split:** 2 bis 3 Tage Ganzkörper A/B im Wechsel, 4 Ober/Unter, 5 Push/Pull/Beine plus Ober/Unter, 6 Push/Pull/Beine doppelt.
- **Volumen:** Muskelaufbau 3 bis 4 x 8 bis 12, Fett verlieren 3 x 10 bis 15 mit kürzeren Pausen, Fitness 3 x 8 bis 15. Anfänger einen Satz weniger.
  Grundübungen 90 bis 150 s Pause, Isolation höchstens 60 s.
- **Progression:** Mindestens die geplante Satzzahl, alle mit demselben (höchsten) Gewicht am oberen Ende geschafft: +2,5 kg (Grundübung) bzw. +1 kg
  (Isolation). Sonst das überwiegend genutzte Gewicht und eine Wiederholung mehr. Ohne Verlauf wird das Startgewicht aus dem Plan vorgeschlagen.
- **Ohne Geräte:** Reicht die Ausrüstung nicht für mindestens 4 Übungen pro Tag, wird auf Ganzkörper A/B ausgewichen (höchstens 3 Einheiten pro Woche empfohlen).
- **Ernährung:** Mifflin-St Jeor mal Aktivitätsfaktor aus den Trainingstagen. Muskelaufbau +300 kcal, Fett verlieren -400 kcal. Eiweiß 1,8 g/kg (Fett verlieren 2,0).
  Das Ziel fällt nie unter den Grundumsatz und nie unter 1200 kcal (w) bzw. 1500 kcal (m, d).
- **Makros:** Fett deckt 25 % der Zielkalorien (9 kcal/g), Kohlenhydrate den Rest nach Eiweiß (4 kcal/g) und Fett, nie negativ.
- **Ernährungsplan heute:** Es gelten die Einträge des Wochentags, "Täglich" und je nach Tag "Trainingstag" oder "Ruhetag". Trainingstag ist, wenn an dem Tag
  ein Workout begonnen wurde (abgeschlossen oder offen) oder der Trainingsplan mit Wochentagen den Tag als Trainingstag führt (Ruhetag oder Wochentag
  ohne Eintrag: Ruhetag). Der Schalter auf der Ernährungsseite überstimmt das für den Tag und wird pro Datum im Browser gemerkt (60 Tage). "Plan eingehalten" zählt von Montag
  bis heute die Mahlzeiten mit "Wie geplant"; ersetzte Mahlzeiten zählen nicht.
- **Pausen-Anzeige:** Kalendertage seit dem letzten abgeschlossenen Training (lokal). 0 bis 7 grün, 8 bis 14 gelb, 15 bis 21 orange, ab 22 rot.
- **Kurven:** Kraft aus der RPC `exercise_progress` (höchstes Gewicht und geschätztes 1RM nach Epley je Trainingstag). Körpergewicht und Körperfett
  als Tageswerte plus gleitender 7-Tage-Schnitt; die Zusammenfassung vergleicht den Schnitt über die letzten 4 Wochen.
- **Verlauf:** Abgeschlossene Trainings lassen sich unter Fortschritt korrigieren (Sätze ändern, löschen, nachtragen, Training löschen). Vorschläge
  fürs nächste Training lesen die Sätze bei jedem Start frisch aus der Datenbank, Korrekturen wirken also sofort.
- **Pläne speichern:** immer über die RPC `create_plan` (eine Transaktion: alter Plan aus, neuer an). Bearbeiten und Import erzeugen einen neuen aktiven Plan.
- **Wochentage und Ruhetage:** Plantage können einen Wochentag haben (`plan_days.weekday`, 0 = Montag bis 6 = Sonntag; alle Tage oder keiner, jeder
  höchstens einmal) und Ruhetage sein (`is_rest`, ohne Übungen). Mit Wochentagen gilt heute der Tag des heutigen Wochentags (lokal); Ruhetag oder
  Wochentag ohne Eintrag zeigt "Heute ist Ruhetag" mit dem nächsten Trainingstag, trainieren lässt sich trotzdem jeder Tag. Ohne Wochentage bleibt
  die Rotation nach dem letzten abgeschlossenen Training, Ruhetage werden dabei übersprungen. Generator und Fragebogen erzeugen Pläne ohne Wochentage.
  Logik in `plan/weekdays.ts` (getestet).

## Plan-Import (Excel oder CSV)

Auf der Plan-Seite unter "Plan aus Excel importieren" (.xlsx oder .csv, höchstens 2 MB). "Vorlage herunterladen" liefert eine CSV-Vorlage.

- **Eine Zeile pro Übung**, darüber eine Kopfzeile. Spaltennamen werden tolerant erkannt (Groß/Klein, Umlaute, Synonyme):
  `Tag`/`Wochentag`, `Fokus`/`Titel`, `Übung` (Pflicht), `Sätze`, `Wiederholungen`/`Wdh` (Pflicht), `Gewicht`, `Hinweise`/`Notiz`, optional `Pause (s)`.
- **Tage** entstehen in der Reihenfolge ihres Auftretens; eine leere Tag-Zelle gehört zum Tag darüber.
- **Wochentage:** Enthält die Tag-Spalte durchgehend Wochentage (Montag bis Sonntag, auch Mo, Di ...), bekommt jeder Tag seinen Wochentag, die Tage
  stehen von Montag bis Sonntag, und Zeilen mit Fokus "Pause"/"Ruhetag" oder Übung "-" werden Ruhetage (Titel "Ruhetag"). Sonst (z. B. "Tag 1")
  gibt es keine Wochentage und solche Zeilen werden übersprungen.
- **Tagestitel** = Fokus, übersetzt (Upper -> Oberkörper, Lower -> Unterkörper, Legs -> Beine, Push/Pull bleiben). Gleicher Fokus mehrfach: A, B, C.
- **Wiederholungen:** `8-10`, `12`, `12 (pro Bein)` (Zusatz wird Hinweis), `Max`/`Versagen` -> 6-15 mit Hinweis, `Max / 5-8` -> 5-8.
- **Gewicht:** erste Zahl wird Startgewicht (`70-75 kg` -> 70), der Originaltext landet zusätzlich im Hinweis.
- **Übungen** werden über Namen und eine Synonymliste der Bibliothek zugeordnet (der eigene Name bleibt sichtbar), sonst als eigene Übung `custom:<slug>`.
  Pause ohne Angabe: Grundübung 120 s, Isolation 60 s, eigene Übung 90 s.
- **Grenzen:** höchstens 7 Tage, 15 Übungen pro Tag, Namen 80 und Hinweise 300 Zeichen, 1 bis 20 Sätze, 1 bis 100 Wiederholungen.
  Fehler werden pro Zeile angezeigt; gespeichert wird erst nach der Vorschau mit "Übernehmen".
- Die Excel-Bibliothek (`read-excel-file`) wird erst beim Import nachgeladen und liegt nicht im Haupt-Bundle.

## Ernährungsplan-Import (Excel oder CSV)

Auf der Ernährungsseite unter "Ernährungsplan" > "Importieren" (.xlsx oder .csv, höchstens 2 MB). "Vorlage herunterladen" liefert eine CSV-Vorlage
mit drei Beispielzeilen (täglich, Trainingstag mit Carb-Loading vor dem Training, Ruhetag).

- **Eine Zeile pro Lebensmittel**, darüber eine Kopfzeile. Spaltennamen werden tolerant erkannt (Groß/Klein, Umlaute, Einheiten in Klammern):
  `Tag`/`Wochentag`, `Mahlzeit` (Pflicht), `Lebensmittel`/`Name` (Pflicht), `Menge`, `kcal`/`Kalorien`, `Eiweiß`/`Protein`,
  `Kohlenhydrate`/`KH`/`Carbs`, `Fett`, `Hinweis`/`Notiz`.
- **Tag:** Montag bis Sonntag (auch Mo, Di ...), `Trainingstag`, `Ruhetag`, `Täglich`/`Alle`. Ohne Tag-Spalte gilt alles täglich.
- **Mahlzeit:** Frühstück, Snack vormittags, Mittag(essen), Snack nachmittags, Abend(essen), Vor dem Training, Nach dem Training, Spät/Spätmahlzeit.
- Leere Tag- oder Mahlzeit-Zellen gehören zur Zeile darüber. Zeilen mit Lebensmittel "-" werden übersprungen.
- **Zahlen:** deutsche Dezimalkommas (`32,5`), Einheiten werden ignoriert (`160 kcal`, `12 g`), leere Zellen bleiben leer.
- **Grenzen:** 1 bis 300 Einträge, Name 120, Menge 60 und Hinweis 300 Zeichen, kcal 0 bis 5000, Makros 0 bis 1000 g.
  Fehler werden pro Zeile angezeigt; gespeichert wird erst nach der Vorschau mit "Übernehmen" (RPC `create_meal_plan`, ersetzt den aktiven Plan).
- Im Editor lassen sich Einträge hinzufügen, ändern und löschen; Speichern übergibt immer die komplette Liste an `create_meal_plan`.
