create table item_items (
  item_id uuid not null references items(id) on delete cascade,
  component_item_id uuid not null references items(id) on delete cascade,
  quantity numeric not null default 1,
  step integer not null default 0,
  primary key (item_id, component_item_id, step)
);

alter table item_items enable row level security;

create policy "public read" on item_items for select using (true);

create policy "admin write" on item_items for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
