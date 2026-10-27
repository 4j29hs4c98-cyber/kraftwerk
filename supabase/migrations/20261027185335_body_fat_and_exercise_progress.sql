-- Kraftwerk: Körperfett und Übungsfortschritt
-- body_weights.body_fat_pct (optional, 3 bis 60 %).
-- RPC exercise_progress: pro Trainingstag höchstes Gewicht und bestes geschätztes 1RM (Epley).

alter table public.body_weights
  add column body_fat_pct numeric(4,1) check (body_fat_pct between 3 and 60);

-- Hilft beim Filtern nach Übung (Fortschritt, letzte Gewichte)
create index workout_sets_user_id_exercise_key_idx
  on public.workout_sets (user_id, exercise_key);

create or replace function public.exercise_progress(p_exercise_key text)
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'date',          t.day,
        'max_weight_kg', t.max_weight_kg,
        'best_e1rm',     t.best_e1rm
      )
      order by t.day
    ),
    '[]'::json
  )
  from (
    select w.finished_at::date                                  as day,
           max(s.weight_kg)                                     as max_weight_kg,
           round(max(s.weight_kg * (1 + s.reps / 30.0)), 1)     as best_e1rm
      from public.workout_sets s
      join public.workouts w
        on w.id = s.workout_id
       and w.user_id = s.user_id
     where s.user_id = (select auth.uid())
       and s.exercise_key = p_exercise_key
       and w.finished_at is not null
       and s.weight_kg is not null
       and s.reps > 0
     group by w.finished_at::date
  ) t;
$$;

revoke execute on function public.exercise_progress(text) from public, anon;
grant execute on function public.exercise_progress(text) to authenticated;
