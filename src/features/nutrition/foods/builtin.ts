/** Nährwerte pro 100 g und eine typische Portion in Gramm. */
export interface FoodNutrients {
  readonly name: string
  readonly kcal100: number
  readonly protein100: number
  readonly carbs100: number
  readonly fat100: number
  /** Typische Portion, null = keine Vorgabe. */
  readonly defaultGrams: number | null
}

const food = (name: string, kcal100: number, protein100: number, carbs100: number, fat100: number, defaultGrams: number): FoodNutrients => ({
  name,
  kcal100,
  protein100,
  carbs100,
  fat100,
  defaultGrams,
})

/**
 * Grundliste mit üblichen Durchschnittswerten (Nährwerttabellen und gängige Packungsangaben).
 * Ob roh oder gekocht, steht im Namen, weil sich die Werte pro 100 g stark unterscheiden.
 * Es sind Richtwerte; Packungsangaben gehen vor und lassen sich als eigenes Lebensmittel speichern.
 */
export const BUILTIN_FOODS: readonly FoodNutrients[] = [
  food('Hähnchenbrust roh', 110, 23.5, 0, 1.5, 180),
  food('Hähnchenbrust gegart (Airfryer)', 165, 31, 0, 3.6, 150),
  food('Reis roh', 350, 7, 77, 0.6, 80),
  food('Reis gekocht', 130, 2.7, 28, 0.3, 250),
  food('Nudeln roh', 355, 12.5, 70, 1.5, 100),
  food('Nudeln gekocht', 150, 5.5, 30, 0.7, 250),
  food('Haferflocken', 370, 13.5, 59, 7, 60),
  food('Skyr natur', 63, 11, 4, 0.2, 250),
  food('Magerquark', 67, 12, 4, 0.3, 250),
  food('Milch 1,5 %', 47, 3.4, 4.9, 1.5, 250),
  food('Whey-Proteinpulver (Durchschnitt)', 380, 75, 8, 6, 30),
  food('Banane', 93, 1.1, 20, 0.2, 120),
  food('Apfel', 54, 0.3, 12, 0.2, 150),
  food('Nüsse gemischt', 610, 18, 12, 54, 30),
  food('Rosinen', 300, 2.5, 68, 0.5, 30),
  food('Lachs roh', 208, 20, 0, 13.5, 150),
  food('Kartoffeln roh', 72, 2, 15.5, 0.1, 300),
  food('Kartoffeln gekocht', 72, 2, 15, 0.1, 300),
  food('Eier roh (ohne Schale)', 140, 12.5, 0.7, 9.5, 120),
  food('Vollkornbrot', 220, 7.5, 38, 2.5, 50),
  food('Mozzarella light', 165, 19, 1, 9, 125),
  food('Rucola', 25, 2.6, 2, 0.7, 30),
  food('Tomate', 18, 0.9, 2.6, 0.2, 100),
  food('Thunfisch natur (abgetropft)', 110, 25, 0, 1, 130),
  food('Erdnussbutter', 600, 25, 12, 49, 20),
  food('Reiswaffeln', 385, 8, 80, 3, 20),
  food('Olivenöl', 884, 0, 0, 100, 10),
  food('Honig', 305, 0.4, 76, 0, 20),
]
