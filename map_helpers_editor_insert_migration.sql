-- Allows map editors (helpers) to add themselves to the Hall of Fame list
-- when they add their first marker, not just admins.
create policy "map editor insert" on map_helpers for insert
  with check (exists (select 1 from map_editors where user_id = auth.uid()));
