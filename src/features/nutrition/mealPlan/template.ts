import { downloadCsv } from '../../plan/import/template'

export const MEAL_TEMPLATE_ROWS: readonly (readonly string[])[] = [
  ['Tag', 'Mahlzeit', 'Lebensmittel', 'Menge', 'kcal', 'Eiweiß (g)', 'Kohlenhydrate (g)', 'Fett (g)', 'Hinweis'],
  ['Täglich', 'Frühstück', 'Haferflocken mit Magerquark und Beeren', '80 g + 250 g + 100 g', '520', '45', '62', '8', ''],
  ['Trainingstag', 'Vor dem Training', 'Reis mit Hähnchenbrust', '150 g Reis gekocht + 120 g', '420', '35', '55', '5', 'Carb-Loading etwa 2 Stunden vor dem Training'],
  ['Ruhetag', 'Abendessen', 'Lachs mit Ofengemüse', '150 g + 300 g', '450', '35', '12', '28', 'An Ruhetagen weniger Kohlenhydrate'],
]

export const MEAL_TEMPLATE_FILE_NAME = 'kraftwerk-ernaehrungsplan-vorlage.csv'

export function downloadMealTemplate(): void {
  downloadCsv(MEAL_TEMPLATE_ROWS, MEAL_TEMPLATE_FILE_NAME)
}
