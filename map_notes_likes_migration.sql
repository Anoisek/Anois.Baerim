alter table map_marker_notes add column if not exists likes integer not null default 0;

create or replace function toggle_note_like(note_id uuid, delta integer)
returns integer
language sql
security definer
set search_path = public
as $$
  update map_marker_notes
  set likes = greatest(0, likes + delta)
  where id = note_id
  returning likes;
$$;

grant execute on function toggle_note_like(uuid, integer) to anon, authenticated;
