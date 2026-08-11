create table exploration_levels (
  level integer primary key,
  title text,
  description text,
  x_percent numeric not null default 50,
  y_percent numeric not null default 50
);
alter table exploration_levels enable row level security;
create policy "public read" on exploration_levels for select using (true);
create policy "admin write" on exploration_levels for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
