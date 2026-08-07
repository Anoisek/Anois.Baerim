-- Kategorie wewnątrz chapterów (subcategories)
create table subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  name text not null,
  image_url text,
  created_at timestamptz default now()
);

-- Itemki dostają przypisanie do kategorii (nullable = "Uncategorized")
alter table items add column subcategory_id uuid references subcategories(id) on delete set null;

alter table subcategories enable row level security;

create policy "public read" on subcategories for select using (true);

create policy "admin write" on subcategories for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
