create or replace function map_pending_reveal()
returns table(map_id uuid, reveal_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select distinct on (map_id) map_id, visible_at as reveal_at
  from map_markers
  where visible_at is not null and visible_at > now()
  order by map_id, created_at desc
$$;

grant execute on function map_pending_reveal() to anon, authenticated;
