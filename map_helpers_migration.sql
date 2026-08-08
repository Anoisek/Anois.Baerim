create table map_helpers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table map_helpers enable row level security;
create policy "public read" on map_helpers for select using (true);
create policy "admin write" on map_helpers for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
