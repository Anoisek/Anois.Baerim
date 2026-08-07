create table global_prices (
  material_id uuid primary key references materials(id) on delete cascade,
  price numeric not null,
  submission_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table global_price_submissions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  price numeric not null,
  created_at timestamptz not null default now()
);

alter table global_prices enable row level security;
alter table global_price_submissions enable row level security;

create policy "public read" on global_prices for select using (true);

create policy "admin write" on global_prices for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admin write" on global_price_submissions for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- Accepts or rejects a submitted price for a material, then recomputes the
-- global price as the median of the last 20 accepted submissions.
-- Tolerance vs the current global price: up to 100% relative deviation,
-- capped at 50kk (50,000,000) absolute — whichever is smaller — with a
-- 1000 yang floor so tiny prices aren't overly strict. First submission for
-- a material is always accepted (nothing to compare against yet).
create or replace function submit_material_price(p_material_id uuid, p_price numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_price numeric;
  allowed_deviation numeric;
  relative_cap constant numeric := 1.0;
  absolute_cap constant numeric := 50000000;
  floor_abs constant numeric := 1000;
  median_price numeric;
  cnt integer;
begin
  if p_price is null or p_price <= 0 then
    return false;
  end if;

  select price into current_price from global_prices where material_id = p_material_id;

  if current_price is not null then
    allowed_deviation := greatest(least(current_price * relative_cap, absolute_cap), floor_abs);
    if abs(p_price - current_price) > allowed_deviation then
      return false;
    end if;
  end if;

  insert into global_price_submissions (material_id, price) values (p_material_id, p_price);

  select count(*), percentile_cont(0.5) within group (order by price)
    into cnt, median_price
  from (
    select price from global_price_submissions
    where material_id = p_material_id
    order by created_at desc
    limit 20
  ) recent;

  insert into global_prices (material_id, price, submission_count, updated_at)
  values (p_material_id, median_price, cnt, now())
  on conflict (material_id) do update
    set price = excluded.price, submission_count = excluded.submission_count, updated_at = now();

  return true;
end;
$$;

grant execute on function submit_material_price(uuid, numeric) to anon, authenticated;
