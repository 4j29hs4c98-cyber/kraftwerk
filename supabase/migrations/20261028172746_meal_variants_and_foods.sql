-- Kraftwerk: Gericht-Varianten im Ernährungsplan, eigene Lebensmittel, Gramm in food_entries.
-- meal_plan_items.variant: gleiche (day_key, meal_slot, variant) bilden ein Gericht,
-- verschiedene variant-Werte im selben Slot sind Alternativen, null = immer gültig.

-- ---------------------------------------------------------------------------
-- meal_plan_items.variant
-- ---------------------------------------------------------------------------
alter table public.meal_plan_items
  add column variant text
    constraint meal_plan_items_variant_check
    check (variant is null or (char_length(btrim(variant)) >= 1 and char_length(variant) <= 60));

-- ---------------------------------------------------------------------------
-- foods: eigene Lebensmittel mit Nährwerten pro 100 g
-- ---------------------------------------------------------------------------
create table public.foods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) >= 1 and char_length(name) <= 80),
  kcal_100      numeric(6,1) not null check (kcal_100 between 0 and 1000),
  protein_100   numeric(5,1) not null check (protein_100 between 0 and 100),
  carbs_100     numeric(5,1) not null check (carbs_100 between 0 and 100),
  fat_100       numeric(5,1) not null check (fat_100 between 0 and 100),
  default_grams numeric(6,1) check (default_grams is null or default_grams between 1 and 2000),
  created_at    timestamptz not null default now()
);

-- Deckt auch Abfragen und den FK über user_id ab
create unique index foods_user_id_lower_name_key on public.foods (user_id, lower(name));

alter table public.foods enable row level security;

create policy "foods_own" on public.foods
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- food_entries.grams
-- ---------------------------------------------------------------------------
alter table public.food_entries
  add column grams numeric(6,1)
    constraint food_entries_grams_check
    check (grams is null or grams between 0 and 5000);

-- ---------------------------------------------------------------------------
-- create_meal_plan: optional "variant" pro Eintrag, bis 600 Einträge
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

  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 600 then
    raise exception 'create_meal_plan: 1 bis 600 Einträge erlaubt' using errcode = '22023';
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
    if v_item ? 'variant' and jsonb_typeof(v_item -> 'variant') <> 'null' then
      if jsonb_typeof(v_item -> 'variant') <> 'string'
         or char_length(btrim(v_item ->> 'variant')) = 0
         or char_length(btrim(v_item ->> 'variant')) > 60 then
        raise exception 'create_meal_plan: variant muss null oder Text mit 1 bis 60 Zeichen sein' using errcode = '22023';
      end if;
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
     kcal, protein_g, carbs_g, fat_g, notes, variant)
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
         nullif(i.value ->> 'notes', ''),
         btrim(i.value ->> 'variant')
    from jsonb_array_elements(p_items) as i;

  return v_plan_id;
end;
$$;

revoke execute on function public.create_meal_plan(text, jsonb) from public, anon;
grant execute on function public.create_meal_plan(text, jsonb) to authenticated;
