-- Private family accounts and privacy-preserving public ward progress.
-- Individual profile and planner rows are readable only by their owning user.

create table public.family_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_name text check (household_name is null or char_length(household_name) <= 80),
  block_id text check (block_id is null or block_id ~ '^[A-R]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.block_captains
add column if not exists building_id text check (building_id is null or building_id ~ '^[A-R]-([1-9]|1[0-9]|2[0-9]|30)$');

create table public.household_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  members jsonb not null default '[]'::jsonb check (jsonb_typeof(members) = 'array' and jsonb_array_length(members) between 1 and 30),
  inventory jsonb not null default '[]'::jsonb check (jsonb_typeof(inventory) = 'array'),
  water_liters numeric not null default 0 check (water_liters between 0 and 100000),
  daily_calories numeric not null default 0 check (daily_calories between 0 and 100000),
  daily_water_liters numeric not null default 0 check (daily_water_liters between 0 and 1000),
  inventory_calories numeric not null default 0 check (inventory_calories between 0 and 1000000000),
  ready_recipe_count integer not null default 0 check (ready_recipe_count between 0 and 1000),
  updated_at timestamptz not null default now()
);

alter table public.family_profiles enable row level security;
alter table public.household_plans enable row level security;

create policy "Families read only their profile"
on public.family_profiles for select to authenticated
using (user_id = auth.uid());
create policy "Families create only their profile"
on public.family_profiles for insert to authenticated
with check (user_id = auth.uid());
create policy "Families update only their profile"
on public.family_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Families delete only their profile"
on public.family_profiles for delete to authenticated
using (user_id = auth.uid());

create policy "Families read only their plan"
on public.household_plans for select to authenticated
using (user_id = auth.uid());
create policy "Families create only their plan"
on public.household_plans for insert to authenticated
with check (user_id = auth.uid());
create policy "Families update only their plan"
on public.household_plans for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Families delete only their plan"
on public.household_plans for delete to authenticated
using (user_id = auth.uid());

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger family_profiles_touch_updated_at
before update on public.family_profiles
for each row execute function public.touch_updated_at();

create trigger household_plans_touch_updated_at
before update on public.household_plans
for each row execute function public.touch_updated_at();

create or replace function public.create_family_profile()
returns trigger
language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.family_profiles (user_id, household_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'household_name'), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger create_family_profile_after_signup
after insert on auth.users
for each row execute function public.create_family_profile();

-- Returns ward-level totals only. Preparedness measures are withheld until at
-- least three families participate, preventing a single household from being
-- inferred from the public dashboard.
create or replace function public.ward_progress_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with plan_stats as (
    select
      p.user_id,
      jsonb_array_length(p.members) as people,
      case when p.daily_water_liters > 0 then p.water_liters / p.daily_water_liters else 0 end as water_days,
      case when p.daily_calories > 0 then p.inventory_calories / p.daily_calories else 0 end as food_days,
      p.water_liters,
      p.inventory_calories,
      p.ready_recipe_count,
      p.updated_at,
      f.block_id
    from public.household_plans p
    left join public.family_profiles f on f.user_id = p.user_id
  ), totals as (
    select count(*)::int as households, coalesce(sum(people), 0)::int as people
    from plan_stats
  ), block_stats as (
    select block_id, count(*)::int as households,
      round(avg(least(100, (least(food_days, 14) / 14 * 50) + (least(water_days, 14) / 14 * 40) + (least(ready_recipe_count, 5)::numeric / 5 * 10))))::int as score
    from plan_stats where block_id is not null group by block_id
  )
  select jsonb_build_object(
    'households', totals.households,
    'people', case when totals.households >= 3 then totals.people else null end,
    'privacy_threshold_met', totals.households >= 3,
    'readiness_score', case when totals.households >= 3 then round(avg(least(100, (least(s.food_days, 14) / 14 * 50) + (least(s.water_days, 14) / 14 * 40) + (least(s.ready_recipe_count, 5)::numeric / 5 * 10))))::int else null end,
    'average_food_days', case when totals.households >= 3 then round(avg(s.food_days), 1) else null end,
    'average_water_days', case when totals.households >= 3 then round(avg(s.water_days), 1) else null end,
    'stored_water_gallons', case when totals.households >= 3 then round(sum(s.water_liters) / 3.78541) else null end,
    'stored_calories', case when totals.households >= 3 then round(sum(s.inventory_calories)) else null end,
    'ready_recipes', case when totals.households >= 3 then sum(s.ready_recipe_count)::int else null end,
    'updated_this_week', case when totals.households >= 3 then count(*) filter (where s.updated_at > now() - interval '7 days')::int else null end,
    'water_3_pct', case when totals.households >= 3 then round(100.0 * count(*) filter (where s.water_days >= 3) / totals.households)::int else null end,
    'water_7_pct', case when totals.households >= 3 then round(100.0 * count(*) filter (where s.water_days >= 7) / totals.households)::int else null end,
    'water_14_pct', case when totals.households >= 3 then round(100.0 * count(*) filter (where s.water_days >= 14) / totals.households)::int else null end,
    'food_3_pct', case when totals.households >= 3 then round(100.0 * count(*) filter (where s.food_days >= 3) / totals.households)::int else null end,
    'food_7_pct', case when totals.households >= 3 then round(100.0 * count(*) filter (where s.food_days >= 7) / totals.households)::int else null end,
    'food_14_pct', case when totals.households >= 3 then round(100.0 * count(*) filter (where s.food_days >= 14) / totals.households)::int else null end,
    'blocks', coalesce((select jsonb_agg(jsonb_build_object(
      'block_id', letters.block_id,
      'households', case when b.households >= 3 then b.households else null end,
      'score', case when b.households >= 3 then b.score else null end
    ) order by letters.block_id)
    from (select chr(generate_series(65, 82)) as block_id) letters
    left join block_stats b on b.block_id = letters.block_id), '[]'::jsonb)
  )
  from totals left join plan_stats s on true
  group by totals.households, totals.people;
$$;

revoke all on function public.ward_progress_stats() from public;
grant execute on function public.ward_progress_stats() to anon, authenticated;

-- Backfill profiles for any users created before this migration.
insert into public.family_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

comment on table public.household_plans is 'Private household preparedness data. RLS permits access only to the owning authenticated family.';
comment on function public.ward_progress_stats() is 'Public, k-anonymous ward-level preparedness totals. Never returns individual household records.';
