alter table categories add column sort_order integer not null default 0;
alter table subcategories add column sort_order integer not null default 0;
alter table items add column sort_order integer not null default 0;

update categories c set sort_order = t.rn * 10 from (
  select id, row_number() over (order by created_at) as rn from categories
) t where t.id = c.id;

update subcategories s set sort_order = t.rn * 10 from (
  select id, row_number() over (partition by category_id order by created_at) as rn from subcategories
) t where t.id = s.id;

update items i set sort_order = t.rn * 10 from (
  select id, row_number() over (partition by category_id, subcategory_id order by name) as rn from items
) t where t.id = i.id;

insert into settings (key, value) values ('materials_sort_order', '0') on conflict (key) do nothing;
insert into settings (key, value) values ('systems_sort_order', '1') on conflict (key) do nothing;
