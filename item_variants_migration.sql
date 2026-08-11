alter table item_materials add column variant integer not null default 1;
alter table item_materials drop constraint item_materials_pkey;
alter table item_materials add primary key (item_id, material_id, step, variant);

alter table item_items add column variant integer not null default 1;
alter table item_items drop constraint item_items_pkey;
alter table item_items add primary key (item_id, component_item_id, step, variant);

alter table item_step_yang add column variant integer not null default 1;
alter table item_step_yang drop constraint item_step_yang_pkey;
alter table item_step_yang add primary key (item_id, step, variant);
