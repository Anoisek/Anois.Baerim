create or replace function map_marker_counts()
returns table(map_id uuid, total bigint)
language sql
security definer
set search_path = public
as $$
  select map_id, count(*) as total
  from map_markers
  group by map_id
$$;

grant execute on function map_marker_counts() to anon, authenticated;
