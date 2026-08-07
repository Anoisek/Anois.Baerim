alter table materials add column is_craftable boolean not null default false;

create table material_materials (
  material_id uuid not null references materials(id) on delete cascade,
  component_id uuid not null references materials(id) on delete cascade,
  quantity numeric not null default 1,
  primary key (material_id, component_id)
);

alter table material_materials enable row level security;

create policy "public read" on material_materials for select using (true);

create policy "admin write" on material_materials for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
