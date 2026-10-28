import { downloadCsv } from '../../plan/import/template'

export const MEAL_TEMPLATE_ROWS: readonly (readonly string[])[] = [
  ['Tag', 'Mahlzeit', 'Variante', 'Lebensmittel', 'Menge', 'kcal', 'Eiweiß (g)', 'Kohlenhydrate (g)', 'Fett (g)', 'Hinweis'],
  ['Täglich', 'Frühstück', '', 'Haferflocken mit Magerquark und Beeren', '80 g + 250 g + 100 g', '520', '45', '62', '8', ''],
  ['Täglich', 'Mittagessen', 'Hähnchen mit Reis', 'Hähnchenbrust gegart', '180 g', '297', '55,8', '0', '6,5', 'Zwei Varianten: in der App wählst du per Wischen'],
  ['Täglich', 'Mittagessen', 'Hähnchen mit Reis', 'Reis gekocht', '250 g', '325', '6,8', '70', '0,8', ''],
  ['Täglich', 'Mittagessen', 'Lachs mit Kartoffeln', 'Lachs', '150 g', '312', '30', '0', '20,3', ''],
  ['Täglich', 'Mittagessen', 'Lachs mit Kartoffeln', 'Kartoffeln gekocht', '300 g', '216', '6', '45', '0,3', ''],
  ['Trainingstag', 'Vor dem Training', '', 'Reis mit Hähnchenbrust', '150 g Reis gekocht + 120 g', '420', '35', '55', '5', 'Carb-Loading etwa 2 Stunden vor dem Training'],
  ['Ruhetag', 'Abendessen', '', 'Lachs mit Ofengemüse', '150 g + 300 g', '450', '35', '12', '28', 'An Ruhetagen weniger Kohlenhydrate'],
]

export const MEAL_TEMPLATE_FILE_NAME = 'kraftwerk-ernaehrungsplan-vorlage.csv'

export function downloadMealTemplate(): void {
  downloadCsv(MEAL_TEMPLATE_ROWS, MEAL_TEMPLATE_FILE_NAME)
}
