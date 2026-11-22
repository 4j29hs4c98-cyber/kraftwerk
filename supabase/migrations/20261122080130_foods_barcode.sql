-- Kraftwerk: optionaler Barcode für eigene Lebensmittel, damit gescannte Produkte offline wiedergefunden werden.
-- EAN-8, UPC-A, EAN-13 und GTIN-14 sind 8 bis 14 Ziffern lang.
alter table public.foods
  add column barcode text
    constraint foods_barcode_check
    check (barcode is null or barcode ~ '^[0-9]{8,14}$');

-- Pro Nutzer darf ein Barcode nur einmal vorkommen; Einträge ohne Barcode sind frei.
-- Deckt auch Abfragen nach (user_id, barcode) ab.
create unique index foods_user_id_barcode_key on public.foods (user_id, barcode)
  where barcode is not null;

-- RLS: Die bestehende Policy "foods_own" gilt für die ganze Tabelle, also auch für die neue Spalte.
