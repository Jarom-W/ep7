-- Repair deployed projects that were created before family addresses were added.
-- The statements are idempotent so this is safe after the private-directory migration.

alter table public.family_profiles
add column if not exists address text
check (address is null or char_length(address) between 3 and 180);

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
  on conflict (user_id) do update
  set household_name = coalesce(excluded.household_name, public.family_profiles.household_name),
      address = coalesce(excluded.address, public.family_profiles.address),
      block_id = coalesce(excluded.block_id, public.family_profiles.block_id),
      household_id = coalesce(excluded.household_id, public.family_profiles.household_id);
  return new;
end;
$$;

-- Ask PostgREST to discard its cached column list immediately after deployment.
notify pgrst, 'reload schema';
