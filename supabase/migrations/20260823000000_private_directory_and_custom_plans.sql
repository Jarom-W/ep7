-- Authenticated ward directory, private household details, ministering access,
-- and user-owned custom pantry content.

alter table public.block_households
add column if not exists building_id text
check (building_id is null or building_id ~ '^[A-R]-([1-9]|1[0-9]|2[0-9]|30)$');

create index if not exists block_households_building_idx
on public.block_households(block_id, building_id);

alter table public.family_profiles
add column if not exists address text
check (address is null or char_length(address) between 3 and 180),
add column if not exists household_id uuid
references public.block_households(id) on delete set null;

create unique index if not exists family_profiles_household_unique
on public.family_profiles(household_id)
where household_id is not null;

alter table public.household_plans
add column if not exists custom_supplies jsonb not null default '[]'::jsonb
check (jsonb_typeof(custom_supplies) = 'array'),
add column if not exists custom_recipes jsonb not null default '[]'::jsonb
check (jsonb_typeof(custom_recipes) = 'array'),
add column if not exists meal_wishlist jsonb not null default '[]'::jsonb
check (jsonb_typeof(meal_wishlist) = 'array');

drop policy if exists "Public captains are readable" on public.block_captains;
drop policy if exists "Public households are readable" on public.block_households;

create policy "Signed in families read captains"
on public.block_captains for select to authenticated
using (is_public or public.is_admin());

create policy "Signed in families read household directory"
on public.block_households for select to authenticated
using (is_public or public.is_admin());

create policy "Admins read family profiles"
on public.family_profiles for select to authenticated
using (public.is_admin());

create policy "Admins update family profiles"
on public.family_profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create table if not exists public.ministering_access (
  id uuid primary key default gen_random_uuid(),
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  target_household_id uuid not null references public.block_households(id) on delete cascade,
  can_write boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (grantee_user_id, target_household_id)
);

alter table public.ministering_access enable row level security;

create policy "Admins manage ministering access"
on public.ministering_access for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Families read their ministering grants"
on public.ministering_access for select to authenticated
using (grantee_user_id = auth.uid());

create or replace function public.can_read_household_detail(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1 from public.family_profiles
      where user_id = auth.uid() and household_id = $1
    )
    or exists (
      select 1 from public.ministering_access
      where grantee_user_id = auth.uid()
        and ministering_access.target_household_id = $1
    )
  );
$$;

create or replace function public.can_write_household_detail(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1 from public.family_profiles
      where user_id = auth.uid() and household_id = $1
    )
    or exists (
      select 1 from public.ministering_access
      where grantee_user_id = auth.uid()
        and ministering_access.target_household_id = $1
        and ministering_access.can_write
    )
  );
$$;

revoke all on function public.can_read_household_detail(uuid) from public;
revoke all on function public.can_write_household_detail(uuid) from public;
grant execute on function public.can_read_household_detail(uuid) to authenticated;
grant execute on function public.can_write_household_detail(uuid) to authenticated;

drop policy if exists "Signed in families read household directory" on public.block_households;
create policy "Signed in families read household directory"
on public.block_households for select to authenticated
using (
  is_public
  or public.is_admin()
  or public.can_read_household_detail(id)
);

create table if not exists public.household_private_details (
  household_id uuid primary key references public.block_households(id) on delete cascade,
  needs text not null default '' check (char_length(needs) <= 5000),
  special_circumstances text not null default '' check (char_length(special_circumstances) <= 5000),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.household_private_details enable row level security;

create policy "Authorized accounts read household details"
on public.household_private_details for select to authenticated
using (public.can_read_household_detail(household_id));

create policy "Authorized accounts create household details"
on public.household_private_details for insert to authenticated
with check (public.can_write_household_detail(household_id));

create policy "Authorized accounts update household details"
on public.household_private_details for update to authenticated
using (public.can_write_household_detail(household_id))
with check (public.can_write_household_detail(household_id));

create trigger household_private_details_touch_updated_at
before update on public.household_private_details
for each row execute function public.touch_updated_at();

create or replace function public.create_family_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_address text := nullif(trim(new.raw_user_meta_data ->> 'address'), '');
  supplied_block text := nullif(upper(trim(new.raw_user_meta_data ->> 'block_id')), '');
  matched_household uuid;
begin
  if supplied_address is not null and supplied_block ~ '^[A-R]$' then
    select id into matched_household
    from public.block_households
    where block_id = supplied_block
      and lower(regexp_replace(coalesce(address, ''), '[^a-zA-Z0-9]', '', 'g')) =
          lower(regexp_replace(supplied_address, '[^a-zA-Z0-9]', '', 'g'))
    limit 1;
  end if;

  insert into public.family_profiles (user_id, household_name, address, block_id, household_id)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'household_name'), ''),
    supplied_address,
    supplied_block,
    matched_household
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on table public.household_private_details is
'Needs and special circumstances protected for the owning family, admins, and explicit ministering grants.';

comment on table public.ministering_access is
'Admin-managed per-household read/write grants for assigned ministering accounts.';
