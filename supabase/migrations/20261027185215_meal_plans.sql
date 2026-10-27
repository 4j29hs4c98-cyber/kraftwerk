-- Kraftwerk: Ernährungspläne (Excel-Import) und tägliches Abhaken
-- meal_plans / meal_plan_items mit RLS nur auf eigene Zeilen und zusammengesetzten FKs.
-- food_entries um Makros, Mahlzeit, Planbezug und Status erweitert.
-- RPC create_meal_plan legt einen Plan atomar an.

-- ---------------------------------------------------------------------------
-- meal_plans
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) >= 1 and char_length(name) <= 80),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index meal_plans_user_id_idx on public.meal_plans (user_id);
create unique index meal_plans_one_active_per_user on public.meal_plans (user_id) where is_active;

alter table public.meal_plans enable row level security;

create policy "meal_plans_own" on public.meal_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- meal_plan_items
-- ---------------------------------------------------------------------------
create table public.meal_plan_items (
  id           uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_key      text not null check (day_key in ('mo','di','mi','do','fr','sa','so','training','ruhe','alle')),
  meal_slot    text not null check (meal_slot in ('fruehstueck','snack_vormittag','mittag','snack_nachmittag','abend','vor_training','nach_training','spaet')),
  position     int not null check (position >= 0),
  name         text not null check (char_length(btrim(name)) >= 1 and char_length(name) <= 120),
  amount       text check (amount is null or char_length(amount) <= 60),
  kcal         int check (kcal between 0 and 5000),
  protein_g    numeric(6,1) check (protein_g between 0 and 1000),
  carbs_g      numeric(6,1) check (carbs_g between 0 and 1000),
  fat_g        numeric(6,1) check (fat_g between 0 and 1000),
  notes        text check (notes is null or char_length(notes) <= 300),
  created_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (meal_plan_id, user_id) references public.meal_plans (id, user_id) on delete cascade
);

create index meal_plan_items_user_id_idx on public.meal_plan_items (user_id);
create index meal_plan_items_meal_plan_id_user_id_idx on public.meal_plan_items (meal_plan_id, user_id);

alter table public.meal_plan_items enable row level security;

create policy "meal_plan_items_own" on public.meal_plan_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- food_entries erweitern
-- ---------------------------------------------------------------------------
alter table public.food_entries
  add column carbs_g           numeric(6,1) check (carbs_g between 0 and 1000),
  add column fat_g             numeric(6,1) check (fat_g between 0 and 1000),
  add column meal_slot         text check (meal_slot in ('fruehstueck','snack_vormittag','mittag','snack_nachmittag','abend','vor_training','nach_training','spaet')),
  add column meal_plan_item_id uuid,
  add column status            text not null default 'frei' check (status in ('wie_geplant','ersetzt','frei'));

-- Beim Löschen des Planeintrags nur meal_plan_item_id leeren, user_id bleibt (PG15+)
alter table public.food_entries
  add constraint food_entries_meal_plan_item_id_user_id_fkey
  foreign key (meal_plan_item_id, user_id) references public.meal_plan_items (id, user_id)
  on delete set null (meal_plan_item_id);

create index food_entries_meal_plan_item_id_user_id_idx
  on public.food_entries (meal_plan_item_id, user_id);

-- Ein Planeintrag pro Tag nur einmal abhakbar
create unique index food_entries_one_per_plan_item_per_day
  on public.food_entries (user_id, eaten_on, meal_plan_item_id)
  where meal_plan_item_id is not null;

-- ---------------------------------------------------------------------------
-- create_meal_plan
-- ---------------------------------------------------------------------------
create or replace function public.create_meal_plan(p_name text, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_plan_id uuid;
  v_item    jsonb;
begin
  if v_uid is null then
    raise exception 'create_meal_plan: nicht angemeldet' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) = 0 or char_length(p_name) > 80 then
    raise exception 'create_meal_plan: Name muss 1 bis 80 Zeichen lang sein' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'create_meal_plan: p_items muss ein JSON-Array sein' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 300 then
    raise exception 'create_meal_plan: 1 bis 300 Einträge erlaubt' using errcode = '22023';
  end if;

  -- Validierung aller Einträge, bevor irgendetwas geschrieben wird.
  -- Wertebereiche prüfen zusätzlich die Check-Constraints der Tabelle.
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'create_meal_plan: jeder Eintrag muss ein Objekt sein' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'day_key') is distinct from 'string'
       or jsonb_typeof(v_item -> 'meal_slot') is distinct from 'string'
       or jsonb_typeof(v_item -> 'name') is distinct from 'string' then
      raise exception 'create_meal_plan: day_key, meal_slot und name sind Pflicht (Text)' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'position') is distinct from 'number' then
      raise exception 'create_meal_plan: position fehlt oder ist keine Zahl' using errcode = '22023';
    end if;
    if (v_item ? 'amount' and jsonb_typeof(v_item -> 'amount') not in ('string', 'null'))
       or (v_item ? 'notes' and jsonb_typeof(v_item -> 'notes') not in ('string', 'null')) then
      raise exception 'create_meal_plan: amount und notes müssen Text sein' using errcode = '22023';
    end if;
    if (v_item ? 'kcal'      and jsonb_typeof(v_item -> 'kcal')      not in ('number', 'null'))
       or (v_item ? 'protein_g' and jsonb_typeof(v_item -> 'protein_g') not in ('number', 'null'))
       or (v_item ? 'carbs_g'   and jsonb_typeof(v_item -> 'carbs_g')   not in ('number', 'null'))
       or (v_item ? 'fat_g'     and jsonb_typeof(v_item -> 'fat_g')     not in ('number', 'null')) then
      raise exception 'create_meal_plan: kcal, protein_g, carbs_g, fat_g müssen Zahlen sein' using errcode = '22023';
    end if;
  end loop;

  update public.meal_plans
     set is_active = false
   where user_id = v_uid
     and is_active;

  insert into public.meal_plans (user_id, name, is_active)
  values (v_uid, btrim(p_name), true)
  returning id into v_plan_id;

  insert into public.meal_plan_items
    (meal_plan_id, user_id, day_key, meal_slot, position, name, amount,
     kcal, protein_g, carbs_g, fat_g, notes)
  select v_plan_id,
         v_uid,
         i.value ->> 'day_key',
         i.value ->> 'meal_slot',
         (i.value ->> 'position')::int,
         btrim(i.value ->> 'name'),
         nullif(btrim(i.value ->> 'amount'), ''),
         round((i.value ->> 'kcal')::numeric)::int,
         (i.value ->> 'protein_g')::numeric,
         (i.value ->> 'carbs_g')::numeric,
         (i.value ->> 'fat_g')::numeric,
         nullif(i.value ->> 'notes', '')
    from jsonb_array_elements(p_items) as i;

  return v_plan_id;
end;
$$;

revoke execute on function public.create_meal_plan(text, jsonb) from public, anon;
grant execute on function public.create_meal_plan(text, jsonb) to authenticated;
