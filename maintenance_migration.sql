alter table categories add column maintenance boolean not null default false;
alter table subcategories add column maintenance boolean not null default false;
alter table items add column maintenance boolean not null default false;
