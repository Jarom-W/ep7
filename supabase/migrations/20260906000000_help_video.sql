-- One public how-to video managed by the specialist.

create table if not exists public.site_media (
  slot text primary key check (slot in ('help-overview')),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 500),
  file_path text not null,
  mime_type text not null check (mime_type in ('video/mp4', 'video/webm', 'video/ogg')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_media enable row level security;

create policy "Site media is public"
on public.site_media for select to anon, authenticated
using (true);

create policy "Admins insert site media"
on public.site_media for insert to authenticated
with check (public.is_admin());

create policy "Admins update site media"
on public.site_media for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins delete site media"
on public.site_media for delete to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('preparedness-media', 'preparedness-media', true, 262144000, array['video/mp4', 'video/webm', 'video/ogg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Site media files are public"
on storage.objects for select to anon, authenticated
using (bucket_id = 'preparedness-media');

create policy "Admins upload site media"
on storage.objects for insert to authenticated
with check (bucket_id = 'preparedness-media' and public.is_admin());

create policy "Admins update site media files"
on storage.objects for update to authenticated
using (bucket_id = 'preparedness-media' and public.is_admin())
with check (bucket_id = 'preparedness-media' and public.is_admin());

create policy "Admins delete site media files"
on storage.objects for delete to authenticated
using (bucket_id = 'preparedness-media' and public.is_admin());

