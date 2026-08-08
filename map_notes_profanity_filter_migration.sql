-- Server-side backstop for the client-side profanity filter: even if someone
-- calls the Supabase API directly (bypassing the site's JS filter), slurs in
-- marker-note comments get censored before they are stored.
-- Add more patterns to the array below if new slurs show up.
create or replace function filter_marker_note_comment()
returns trigger as $$
declare
  patterns text[] := array[
    'n[i1!|]+g{2,}[e3]r+',
    'n[i1!|]+g{2,}[a4@]'
  ];
  p text;
begin
  if new.comment is not null then
    foreach p in array patterns loop
      new.comment := regexp_replace(new.comment, p, '****', 'gi');
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists map_marker_notes_filter on map_marker_notes;
create trigger map_marker_notes_filter
  before insert or update on map_marker_notes
  for each row execute function filter_marker_note_comment();
