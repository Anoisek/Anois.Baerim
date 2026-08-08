-- Server-side backstop for the client-side profanity filter: even if someone
-- calls the Supabase API directly (bypassing the site's JS filter), slurs in
-- marker-note comments get censored before they are stored.
-- Keep this list in sync with src/utils/profanityFilter.js.
-- Add more patterns to the array below if new slurs/troll words show up.
create or replace function filter_marker_note_comment()
returns trigger as $$
declare
  patterns text[] := array[
    'n[i1!|]+g{2,}[e3]r+',
    'n[i1!|]+g{2,}[a4@]',
    'k[i1!|]k[e3]',
    'ch[i1!|]nk',
    'g[o0]{2,}k',
    'sp[i1!|]c',
    'f[a4@]g{2,}[o0]t',
    '\yf[a4@]g\y',
    'tr[a4@]nn?y',
    'r[e3]t[a4@]rd',
    'c[u0]nt',
    'p[e3]d[a4@][lł]'
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
