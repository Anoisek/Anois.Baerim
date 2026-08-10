create table material_craft_variant_yield (
  material_id uuid not null references materials(id) on delete cascade,
  variant integer not null,
  yield integer not null default 1,
  primary key (material_id, variant)
);

alter table material_craft_variant_yield enable row level security;

create policy "public read" on material_craft_variant_yield for select using (true);

create policy "admin write" on material_craft_variant_yield for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
