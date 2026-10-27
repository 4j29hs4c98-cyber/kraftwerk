-- Kraftwerk: Korrekturen aus dem Code-Review
-- 1. RPC create_plan: Plan inklusive Tage und Übungen atomar anlegen
-- 2. workout_sets: eindeutiger Satz pro (workout, Übung, Satznummer) für upsert
-- 3. RPC training_stats: Kennzahlen für den eingeloggten Nutzer
-- 4. Plausibilitäts-Checks

-- ---------------------------------------------------------------------------
-- 1. create_plan
-- ---------------------------------------------------------------------------
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

    v_exercises := coalesce(v_day -> 'exercises', '[]'::jsonb);
    if jsonb_typeof(v_exercises) <> 'array' then
      raise exception 'create_plan: exercises muss ein JSON-Array sein' using errcode = '22023';
    end if;
    if jsonb_array_length(v_exercises) > 15 then
      raise exception 'create_plan: höchstens 15 Übungen pro Tag' using errcode = '22023';
    end if;

    for v_ex in select value from jsonb_array_elements(v_exercises) loop
      if jsonb_typeof(v_ex) <> 'object'
         or jsonb_typeof(v_ex -> 'exercise_key') is distinct from 'string'
         or char_length(btrim(v_ex ->> 'exercise_key')) = 0
         or char_length(v_ex ->> 'exercise_key') > 100 then
        raise exception 'create_plan: exercise_key muss Text mit 1 bis 100 Zeichen sein' using errcode = '22023';
      end if;
      if jsonb_typeof(v_ex -> 'position') is distinct from 'number' then
        raise exception 'create_plan: position fehlt oder ist keine Zahl' using errcode = '22023';
      end if;
      if (v_ex ? 'sets'         and jsonb_typeof(v_ex -> 'sets')         not in ('number', 'null'))
         or (v_ex ? 'rep_min'      and jsonb_typeof(v_ex -> 'rep_min')      not in ('number', 'null'))
         or (v_ex ? 'rep_max'      and jsonb_typeof(v_ex -> 'rep_max')      not in ('number', 'null'))
         or (v_ex ? 'rest_seconds' and jsonb_typeof(v_ex -> 'rest_seconds') not in ('number', 'null')) then
        raise exception 'create_plan: sets, rep_min, rep_max, rest_seconds müssen Zahlen sein' using errcode = '22023';
      end if;
      if coalesce((v_ex ->> 'sets')::int, 1) not between 1 and 20
         or coalesce((v_ex ->> 'rep_min')::int, 1) not between 1 and 100
         or coalesce((v_ex ->> 'rep_max')::int, 1) not between 1 and 100
         or coalesce((v_ex ->> 'rest_seconds')::int, 0) not between 0 and 1800 then
        raise exception 'create_plan: sets 1-20, Wiederholungen 1-100, Pause 0-1800 s' using errcode = '22023';
      end if;
    end loop;
  end loop;

  if (select count(distinct (value ->> 'day_index')::int) from jsonb_array_elements(p_days))
     <> jsonb_array_length(p_days) then
    raise exception 'create_plan: day_index doppelt vergeben' using errcode = '22023';
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

    insert into public.plan_days (plan_id, user_id, day_index, title)
    values (v_plan_id, v_uid, v_day_index, v_day ->> 'title')
    returning id into v_day_id;

    insert into public.plan_exercises
      (plan_day_id, user_id, exercise_key, position, sets, rep_min, rep_max, rest_seconds)
    select v_day_id,
           v_uid,
           e.value ->> 'exercise_key',
           (e.value ->> 'position')::int,
           (e.value ->> 'sets')::int,
           (e.value ->> 'rep_min')::int,
           (e.value ->> 'rep_max')::int,
           (e.value ->> 'rest_seconds')::int
      from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb)) as e;
  end loop;

  return v_plan_id;
end;
$$;

revoke execute on function public.create_plan(text, text, jsonb) from public, anon;
grant execute on function public.create_plan(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. workout_sets: eindeutige Satznummer pro Übung und Workout
--    (vor der Migration geprüft: keine Duplikate vorhanden)
-- ---------------------------------------------------------------------------
alter table public.workout_sets
  add constraint workout_sets_workout_exercise_set_key
  unique (workout_id, exercise_key, set_index);

-- ---------------------------------------------------------------------------
-- 3. training_stats
-- ---------------------------------------------------------------------------
create or replace function public.training_stats()
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with finished as (
    select w.id, w.finished_at
      from public.workouts w
     where w.user_id = (select auth.uid())
       and w.finished_at is not null
  )
  select json_build_object(
    'workouts_count', (select count(*) from finished)::int,
    'total_volume', (
      select coalesce(sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0)), 0)
        from public.workout_sets s
        join finished f on f.id = s.workout_id
       where s.user_id = (select auth.uid())
    ),
    'finished_dates', (
      select coalesce(json_agg(d.day order by d.day), '[]'::json)
        from (select distinct f.finished_at::date as day from finished f) d
    )
  );
$$;

revoke execute on function public.training_stats() from public, anon;
grant execute on function public.training_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Plausibilitäts-Checks (vorher geprüft: keine bestehende Zeile verletzt sie)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 60);

alter table public.food_entries
  add constraint food_entries_name_length
  check (char_length(btrim(name)) >= 1 and char_length(name) <= 120);

alter table public.food_entries
  add constraint food_entries_kcal_max
  check (kcal <= 10000);

alter table public.workout_sets
  add constraint workout_sets_weight_kg_max
  check (weight_kg <= 1000);

alter table public.workout_sets
  add constraint workout_sets_reps_max
  check (reps <= 1000);

alter table public.body_weights
  add constraint body_weights_weight_kg_range
  check (weight_kg between 20 and 400);
