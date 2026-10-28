-- Kraftwerk: Wochentage und Ruhetage im Trainingsplan
-- plan_days.weekday (0 = Montag bis 6 = Sonntag, optional) und plan_days.is_rest.
-- Bestehende Zeilen bleiben gültig (weekday null, is_rest false).
-- create_plan übernimmt weekday und is_rest; Ruhetage dürfen keine Übungen haben.

alter table public.plan_days
  add column weekday smallint check (weekday between 0 and 6),
  add column is_rest boolean not null default false;

create unique index plan_days_plan_id_weekday_key
  on public.plan_days (plan_id, weekday)
  where weekday is not null;

create or replace function public.create_plan(p_name text, p_split text, p_days jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_plan_id   uuid;
  v_day_id    uuid;
  v_day       jsonb;
  v_ex        jsonb;
  v_exercises jsonb;
  v_day_index int;
  v_weekday_count    int;
  v_weekday_distinct int;
begin
  if v_uid is null then
    raise exception 'create_plan: nicht angemeldet' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) = 0 or char_length(p_name) > 100 then
    raise exception 'create_plan: Name muss 1 bis 100 Zeichen lang sein' using errcode = '22023';
  end if;

  if p_split is not null and char_length(p_split) > 60 then
    raise exception 'create_plan: Split darf höchstens 60 Zeichen lang sein' using errcode = '22023';
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' then
    raise exception 'create_plan: p_days muss ein JSON-Array sein' using errcode = '22023';
  end if;

  if jsonb_array_length(p_days) = 0 or jsonb_array_length(p_days) > 7 then
    raise exception 'create_plan: 1 bis 7 Tage erlaubt' using errcode = '22023';
  end if;

  -- Validierung aller Tage und Übungen, bevor irgendetwas geschrieben wird
  for v_day in select value from jsonb_array_elements(p_days) loop
    if jsonb_typeof(v_day) <> 'object'
       or jsonb_typeof(v_day -> 'day_index') is distinct from 'number'
       or (v_day ->> 'day_index')::numeric <> floor((v_day ->> 'day_index')::numeric)
       or (v_day ->> 'day_index')::numeric not between 0 and 6 then
      raise exception 'create_plan: day_index muss eine ganze Zahl von 0 bis 6 sein' using errcode = '22023';
    end if;

    if v_day ? 'title' and jsonb_typeof(v_day -> 'title') not in ('string', 'null') then
      raise exception 'create_plan: title muss Text sein' using errcode = '22023';
    end if;
    if char_length(coalesce(v_day ->> 'title', '')) > 60 then
      raise exception 'create_plan: title darf höchstens 60 Zeichen lang sein' using errcode = '22023';
    end if;

    if v_day ? 'weekday'
       and jsonb_typeof(v_day -> 'weekday') <> 'null'
       and (jsonb_typeof(v_day -> 'weekday') <> 'number'
            or (v_day ->> 'weekday')::numeric <> floor((v_day ->> 'weekday')::numeric)
            or (v_day ->> 'weekday')::numeric not between 0 and 6) then
      raise exception 'create_plan: weekday muss eine ganze Zahl von 0 (Montag) bis 6 (Sonntag) oder null sein' using errcode = '22023';
    end if;

    if v_day ? 'is_rest' and jsonb_typeof(v_day -> 'is_rest') not in ('boolean', 'null') then
      raise exception 'create_plan: is_rest muss true oder false sein' using errcode = '22023';
    end if;

    v_exercises := coalesce(v_day -> 'exercises', '[]'::jsonb);
    if jsonb_typeof(v_exercises) = 'null' then
      v_exercises := '[]'::jsonb;
    end if;
    if jsonb_typeof(v_exercises) <> 'array' then
      raise exception 'create_plan: exercises muss ein JSON-Array sein' using errcode = '22023';
    end if;
    if coalesce((v_day ->> 'is_rest')::boolean, false) and jsonb_array_length(v_exercises) > 0 then
      raise exception 'create_plan: Ruhetage dürfen keine Übungen haben' using errcode = '22023';
    end if;
    if jsonb_array_length(v_exercises) > 15 then
      raise exception 'create_plan: höchstens 15 Übungen pro Tag' using errcode = '22023';
    end if;

    for v_ex in select value from jsonb_array_elements(v_exercises) loop
      if jsonb_typeof(v_ex) <> 'object'
         or jsonb_typeof(v_ex -> 'exercise_key') is distinct from 'string'
         or (v_ex ->> 'exercise_key') !~ '^(custom:)?[a-z0-9_]{1,60}$' then
        raise exception 'create_plan: exercise_key ungültig (erlaubt: [a-z0-9_], optional mit Präfix custom:)' using errcode = '22023';
      end if;
      if (v_ex ? 'display_name' and jsonb_typeof(v_ex -> 'display_name') not in ('string', 'null'))
         or (v_ex ? 'notes' and jsonb_typeof(v_ex -> 'notes') not in ('string', 'null')) then
        raise exception 'create_plan: display_name und notes müssen Text sein' using errcode = '22023';
      end if;
      if (v_ex ->> 'display_name') is not null
         and char_length(btrim(v_ex ->> 'display_name')) not between 1 and 80 then
        raise exception 'create_plan: display_name muss 1 bis 80 Zeichen lang sein' using errcode = '22023';
      end if;
      if (v_ex ->> 'exercise_key') like 'custom:%' and (v_ex ->> 'display_name') is null then
        raise exception 'create_plan: eigene Übungen (custom:) brauchen display_name' using errcode = '22023';
      end if;
      if char_length(coalesce(v_ex ->> 'notes', '')) > 300 then
        raise exception 'create_plan: notes darf höchstens 300 Zeichen lang sein' using errcode = '22023';
      end if;
      if jsonb_typeof(v_ex -> 'position') is distinct from 'number' then
        raise exception 'create_plan: position fehlt oder ist keine Zahl' using errcode = '22023';
      end if;
      if (v_ex ? 'sets'         and jsonb_typeof(v_ex -> 'sets')         not in ('number', 'null'))
         or (v_ex ? 'rep_min'      and jsonb_typeof(v_ex -> 'rep_min')      not in ('number', 'null'))
         or (v_ex ? 'rep_max'      and jsonb_typeof(v_ex -> 'rep_max')      not in ('number', 'null'))
         or (v_ex ? 'rest_seconds' and jsonb_typeof(v_ex -> 'rest_seconds') not in ('number', 'null'))
         or (v_ex ? 'start_weight_kg' and jsonb_typeof(v_ex -> 'start_weight_kg') not in ('number', 'null')) then
        raise exception 'create_plan: sets, rep_min, rep_max, rest_seconds, start_weight_kg müssen Zahlen sein' using errcode = '22023';
      end if;
      if coalesce((v_ex ->> 'sets')::int, 1) not between 1 and 20
         or coalesce((v_ex ->> 'rep_min')::int, 1) not between 1 and 100
         or coalesce((v_ex ->> 'rep_max')::int, 1) not between 1 and 100
         or coalesce((v_ex ->> 'rest_seconds')::int, 0) not between 0 and 1800
         or coalesce((v_ex ->> 'start_weight_kg')::numeric, 0) not between 0 and 1000 then
        raise exception 'create_plan: sets 1-20, Wiederholungen 1-100, Pause 0-1800 s, Startgewicht 0-1000 kg' using errcode = '22023';
      end if;
    end loop;
  end loop;

  if (select count(distinct (value ->> 'day_index')::int) from jsonb_array_elements(p_days))
     <> jsonb_array_length(p_days) then
    raise exception 'create_plan: day_index doppelt vergeben' using errcode = '22023';
  end if;

  select count(*) filter (where jsonb_typeof(value -> 'weekday') = 'number'),
         count(distinct (value ->> 'weekday')::int) filter (where jsonb_typeof(value -> 'weekday') = 'number')
    into v_weekday_count, v_weekday_distinct
    from jsonb_array_elements(p_days);

  if v_weekday_count not in (0, jsonb_array_length(p_days)) then
    raise exception 'create_plan: entweder alle Tage oder keiner mit weekday' using errcode = '22023';
  end if;
  if v_weekday_distinct <> v_weekday_count then
    raise exception 'create_plan: weekday doppelt vergeben' using errcode = '22023';
  end if;

  -- Schreiben: alter aktiver Plan aus, neuer Plan an
  update public.plans
     set is_active = false
   where user_id = v_uid
     and is_active;

  insert into public.plans (user_id, name, split, is_active)
  values (v_uid, btrim(p_name), p_split, true)
  returning id into v_plan_id;

  for v_day in select value from jsonb_array_elements(p_days) loop
    v_day_index := (v_day ->> 'day_index')::int;

    insert into public.plan_days (plan_id, user_id, day_index, title, weekday, is_rest)
    values (v_plan_id, v_uid, v_day_index, v_day ->> 'title',
            (v_day ->> 'weekday')::smallint,
            coalesce((v_day ->> 'is_rest')::boolean, false))
    returning id into v_day_id;

    insert into public.plan_exercises
      (plan_day_id, user_id, exercise_key, display_name, notes,
       position, sets, rep_min, rep_max, rest_seconds, start_weight_kg)
    select v_day_id,
           v_uid,
           e.value ->> 'exercise_key',
           nullif(btrim(e.value ->> 'display_name'), ''),
           nullif(e.value ->> 'notes', ''),
           (e.value ->> 'position')::int,
           (e.value ->> 'sets')::int,
           (e.value ->> 'rep_min')::int,
           (e.value ->> 'rep_max')::int,
           (e.value ->> 'rest_seconds')::int,
           (e.value ->> 'start_weight_kg')::numeric
      from jsonb_array_elements(coalesce(nullif(v_day -> 'exercises', 'null'::jsonb), '[]'::jsonb)) as e;
  end loop;

  return v_plan_id;
end;
$$;

-- create or replace behält die Rechte, zur Sicherheit erneut gesetzt
revoke execute on function public.create_plan(text, text, jsonb) from public, anon;
grant execute on function public.create_plan(text, text, jsonb) to authenticated;
