create table maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  mark text not null,
  image_url text,
  width integer not null,
  height integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table maps enable row level security;
create policy "public read" on maps for select using (true);
create policy "admin write" on maps for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create table map_markers (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  x numeric not null,
  y numeric not null,
  icon text not null default '📍',
  title text,
  created_at timestamptz not null default now()
);
alter table map_markers enable row level security;
create policy "public read" on map_markers for select using (true);
create policy "admin write" on map_markers for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create table map_marker_notes (
  id uuid primary key default gen_random_uuid(),
  marker_id uuid not null references map_markers(id) on delete cascade,
  comment text,
  image_url text,
  created_at timestamptz not null default now()
);
alter table map_marker_notes enable row level security;
create policy "public read" on map_marker_notes for select using (true);
create policy "public insert" on map_marker_notes for insert
  with check (
    (comment is not null and char_length(comment) between 1 and 1000)
    or image_url is not null
  );
create policy "admin delete" on map_marker_notes for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

-- New bucket for anonymous marker-note photo uploads (map backgrounds stay in the existing 'images' bucket, admin-only, unchanged)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('map-notes', 'map-notes', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "map-notes public read" on storage.objects for select using (bucket_id = 'map-notes');
create policy "map-notes public insert" on storage.objects for insert with check (bucket_id = 'map-notes');
create policy "map-notes admin delete" on storage.objects for delete
  using (bucket_id = 'map-notes' and exists (select 1 from admins where user_id = auth.uid()));
