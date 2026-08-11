-- Fix: the primary key on material_materials did not include `variant`, so two
-- craft variants sharing the same component would collide on insert.
alter table material_materials drop constraint material_materials_pkey;
alter table material_materials add primary key (material_id, component_id, variant);
