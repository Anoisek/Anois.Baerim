create table map_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table map_editors enable row level security;

-- a logged-in user can check their own row (needed for the app to know they have this role)
create policy "self read" on map_editors for select
  using (user_id = auth.uid());

-- only full admins can grant/revoke this role
create policy "admin write" on map_editors for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- map editors can ADD markers, but cannot update/delete them (that stays admin-only via the existing "admin write" policy on map_markers)
create policy "map editor insert" on map_markers for insert
  with check (exists (select 1 from map_editors where user_id = auth.uid()));
