alter table map_markers add column if not exists visible_at timestamptz;

drop policy if exists "public read" on map_markers;
create policy "public read" on map_markers for select
  using (
    visible_at is null
    or visible_at <= now()
    or exists (select 1 from admins where user_id = auth.uid())
  );
