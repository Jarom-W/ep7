-- Ward preparedness site: shared content, specialist role, private map, and feedback.
-- Run with `supabase db push` or paste into the Supabase SQL editor once.

create extension if not exists pgcrypto;

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

create policy "Users can read their own role"
on public.user_roles for select to authenticated
using (user_id = auth.uid());

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  kind text not null check (kind in ('newsletter', 'plan')),
  file_path text not null,
  description text,
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index documents_kind_published_idx on public.documents(kind, published_at desc);
alter table public.documents enable row level security;
create policy "Documents are public" on public.documents for select to anon, authenticated using (true);
create policy "Admins insert documents" on public.documents for insert to authenticated with check (public.is_admin());
create policy "Admins update documents" on public.documents for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete documents" on public.documents for delete to authenticated using (public.is_admin());

create table public.block_captains (
  id uuid primary key default gen_random_uuid(),
  block_id text not null check (block_id ~ '^[A-R]$'),
  name text not null check (char_length(name) between 1 and 120),
  address text,
  phone text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.block_households (
  id uuid primary key default gen_random_uuid(),
  block_id text not null check (block_id ~ '^[A-R]$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  address text,
  notes text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.block_captains enable row level security;
alter table public.block_households enable row level security;

create policy "Public captains are readable" on public.block_captains for select to anon, authenticated using (is_public or public.is_admin());
create policy "Admins insert captains" on public.block_captains for insert to authenticated with check (public.is_admin());
create policy "Admins update captains" on public.block_captains for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete captains" on public.block_captains for delete to authenticated using (public.is_admin());
create policy "Public households are readable" on public.block_households for select to anon, authenticated using (is_public or public.is_admin());
create policy "Admins insert households" on public.block_households for insert to authenticated with check (public.is_admin());
create policy "Admins update households" on public.block_households for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete households" on public.block_households for delete to authenticated using (public.is_admin());

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'feature')),
  name text,
  email text,
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
create policy "Admins read feedback" on public.feedback for select to authenticated using (public.is_admin());
create policy "Admins update feedback" on public.feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('preparedness-documents', 'preparedness-documents', true, 20971520, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "PDFs are public"
on storage.objects for select to anon, authenticated
using (bucket_id = 'preparedness-documents');

create policy "Admins upload PDFs"
on storage.objects for insert to authenticated
with check (bucket_id = 'preparedness-documents' and public.is_admin());

create policy "Admins update PDFs"
on storage.objects for update to authenticated
using (bucket_id = 'preparedness-documents' and public.is_admin())
with check (bucket_id = 'preparedness-documents' and public.is_admin());

create policy "Admins delete PDFs"
on storage.objects for delete to authenticated
using (bucket_id = 'preparedness-documents' and public.is_admin());

-- After creating the specialist user in Authentication > Users, grant access once:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'YOUR_SPECIALIST_EMAIL';
