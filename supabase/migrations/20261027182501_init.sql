-- Kraftwerk: Grundschema
-- Alle Tabellen mit RLS, Zugriff nur auf eigene Zeilen.
-- Kindtabellen nutzen zusammengesetzte Fremdschlüssel (fk_id, user_id) -> parent(id, user_id),
-- damit niemand eigene Zeilen an fremde Pläne oder Workouts hängen kann.

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: updated_at pflegen
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  sex           text check (sex in ('m', 'w', 'd')),
  birth_year    int check (birth_year between 1900 and 2100),
  height_cm     int check (height_cm between 50 and 300),
  goal          text check (goal in ('muskelaufbau', 'fett_verlieren', 'fitness')),
  level         text check (level in ('anfaenger', 'fortgeschritten', 'profi')),
  days_per_week int check (days_per_week between 2 and 6),
  location      text check (location in ('home', 'gym')),
  equipment     text[] not null default '{}',
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Leere Profilzeile bei neuer Registrierung
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  split      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index plans_user_id_idx on public.plans (user_id);
create unique index plans_one_active_per_user on public.plans (user_id) where is_active;

alter table public.plans enable row level security;

create policy "plans_own" on public.plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- plan_days
-- ---------------------------------------------------------------------------
create table public.plan_days (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_index  int not null check (day_index >= 0),
  title      text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete cascade
);

create index plan_days_user_id_idx on public.plan_days (user_id);
create index plan_days_plan_id_user_id_idx on public.plan_days (plan_id, user_id);

alter table public.plan_days enable row level security;

create policy "plan_days_own" on public.plan_days
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- plan_exercises
-- ---------------------------------------------------------------------------
create table public.plan_exercises (
  id           uuid primary key default gen_random_uuid(),
  plan_day_id  uuid not null,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_key text not null,
  position     int not null check (position >= 0),
  sets         int check (sets > 0),
  rep_min      int check (rep_min > 0),
  rep_max      int check (rep_max > 0),
  rest_seconds int check (rest_seconds >= 0),
  created_at   timestamptz not null default now(),
  check (rep_min is null or rep_max is null or rep_min <= rep_max),
  foreign key (plan_day_id, user_id) references public.plan_days (id, user_id) on delete cascade
);

create index plan_exercises_user_id_idx on public.plan_exercises (user_id);
create index plan_exercises_plan_day_id_user_id_idx on public.plan_exercises (plan_day_id, user_id);

alter table public.plan_exercises enable row level security;

create policy "plan_exercises_own" on public.plan_exercises
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------
create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_day_id uuid,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  check (finished_at is null or finished_at >= started_at),
  -- Beim Löschen des Plantags nur plan_day_id leeren, user_id bleibt (PG15+)
  foreign key (plan_day_id, user_id) references public.plan_days (id, user_id)
    on delete set null (plan_day_id)
);

create index workouts_user_id_idx on public.workouts (user_id);
create index workouts_plan_day_id_user_id_idx on public.workouts (plan_day_id, user_id);

alter table public.workouts enable row level security;

create policy "workouts_own" on public.workouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- workout_sets
-- ---------------------------------------------------------------------------
create table public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_key text not null,
  set_index    int not null check (set_index >= 0),
  weight_kg    numeric(6,2) check (weight_kg >= 0),
  reps         int check (reps >= 0),
  created_at   timestamptz not null default now(),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);

create index workout_sets_user_id_idx on public.workout_sets (user_id);
create index workout_sets_workout_id_user_id_idx on public.workout_sets (workout_id, user_id);

alter table public.workout_sets enable row level security;

create policy "workout_sets_own" on public.workout_sets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- body_weights
-- ---------------------------------------------------------------------------
create table public.body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg   numeric(5,2) not null check (weight_kg > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on) -- deckt auch den Index auf user_id ab
);

alter table public.body_weights enable row level security;

create policy "body_weights_own" on public.body_weights
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- food_entries
-- ---------------------------------------------------------------------------
create table public.food_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on   date not null default current_date,
  name       text not null,
  kcal       int check (kcal >= 0),
  protein_g  numeric(6,1) check (protein_g >= 0),
  created_at timestamptz not null default now()
);

create index food_entries_user_id_eaten_on_idx on public.food_entries (user_id, eaten_on);

alter table public.food_entries enable row level security;

create policy "food_entries_own" on public.food_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
