create or replace function public.get_ops_metrics_v1(_from timestamptz, _to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz text := 'Asia/Riyadh';
  today_start timestamptz := (date_trunc('day', (now() at time zone tz)) at time zone tz);
  yest_start  timestamptz := today_start - interval '1 day';
  week_start  timestamptz := today_start - interval '6 day';
  pweek_start timestamptz := today_start - interval '13 day';
  daily_start timestamptz := today_start - interval '29 day';
  hourly boolean := (_to - _from) <= interval '36 hours';
  result jsonb;
begin
  if not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'staff') or public.has_role(auth.uid(),'super_admin')) then
    raise exception 'forbidden';
  end if;

  with
  ev as (
    select session_id, created_at,
           lag(created_at) over (partition by session_id order by created_at) as prev
    from analytics_events
    where created_at >= least(pweek_start, daily_start, _from)
  ),
  sess as (
    select created_at
    from ev
    where session_id is not null
      and (prev is null or created_at - prev > interval '30 minutes')
  ),
  ord as (
    select created_at,
           greatest(0, coalesce(total,0) - coalesce(refunded_amount,0)) as net
    from orders
    where created_at >= least(pweek_start, daily_start, _from)
      and payment_status in ('paid','captured')
      and coalesce(status,'') not in ('cancelled','refunded','returned','payment_failed')
  ),
  err as (
    select created_at, severity, category, resolved
    from error_logs
    where created_at >= least(pweek_start, daily_start, _from)
  ),
  apilogs as (
    select created_at, status_code, duration_ms
    from api_request_logs
    where created_at between _from and _to
  ),
  perf as (
    select metric, value from perf_metrics where created_at between _from and _to
  ),
  cmp as (
    select jsonb_build_object(
      'rev', jsonb_build_object(
        'today',     (select coalesce(sum(net),0) from ord where created_at >= today_start),
        'yesterday', (select coalesce(sum(net),0) from ord where created_at >= yest_start and created_at < today_start),
        'thisWeek',  (select coalesce(sum(net),0) from ord where created_at >= week_start),
        'prevWeek',  (select coalesce(sum(net),0) from ord where created_at >= pweek_start and created_at < week_start)),
      'ord', jsonb_build_object(
        'today',     (select count(*) from ord where created_at >= today_start),
        'yesterday', (select count(*) from ord where created_at >= yest_start and created_at < today_start),
        'thisWeek',  (select count(*) from ord where created_at >= week_start),
        'prevWeek',  (select count(*) from ord where created_at >= pweek_start and created_at < week_start)),
      'ses', jsonb_build_object(
        'today',     (select count(*) from sess where created_at >= today_start),
        'yesterday', (select count(*) from sess where created_at >= yest_start and created_at < today_start),
        'thisWeek',  (select count(*) from sess where created_at >= week_start),
        'prevWeek',  (select count(*) from sess where created_at >= pweek_start and created_at < week_start)),
      'errC', jsonb_build_object(
        'today',     (select count(*) from err where created_at >= today_start),
        'yesterday', (select count(*) from err where created_at >= yest_start and created_at < today_start),
        'thisWeek',  (select count(*) from err where created_at >= week_start),
        'prevWeek',  (select count(*) from err where created_at >= pweek_start and created_at < week_start))
    ) as j
  ),
  days as (
    select generate_series(daily_start, today_start, interval '1 day') as d
  ),
  daily as (
    select jsonb_agg(jsonb_build_object(
      'label', to_char(d at time zone tz, 'MM-DD'),
      'revenue', (select coalesce(round(sum(net)),0) from ord o where o.created_at >= d and o.created_at < d + interval '1 day'),
      'orders',  (select count(*) from ord o where o.created_at >= d and o.created_at < d + interval '1 day'),
      'sessions',(select count(*) from sess s where s.created_at >= d and s.created_at < d + interval '1 day'),
      'errors',  (select count(*) from err e where e.created_at >= d and e.created_at < d + interval '1 day')
    ) order by d) as j
    from days
  ),
  series as (
    select jsonb_agg(x order by x->>'ts') as j from (
      select jsonb_build_object(
        'ts', ts,
        'req', sum(req), 'err5xx', sum(err5xx), 'errors', sum(errors),
        'avg_ms', case when sum(n) > 0 then round(sum(total_ms)::numeric/sum(n)) else 0 end
      ) as x
      from (
        select to_char(created_at at time zone tz, case when hourly then 'MM-DD HH24":00"' else 'MM-DD' end) as ts,
               1 as req,
               case when coalesce(status_code,0) >= 500 then 1 else 0 end as err5xx,
               0 as errors,
               coalesce(duration_ms,0) as total_ms,
               case when duration_ms is not null then 1 else 0 end as n
        from apilogs
        union all
        select to_char(created_at at time zone tz, case when hourly then 'MM-DD HH24":00"' else 'MM-DD' end),
               0, 0, 1, 0, 0
        from err where created_at between _from and _to
      ) u
      group by ts
    ) g
  ),
  vitals as (
    select jsonb_agg(jsonb_build_object(
      'metric', metric,
      'p75', round(percentile_cont(0.75) within group (order by value)::numeric, 2),
      'avg', round(avg(value)::numeric, 2),
      'samples', count(*)
    )) as j
    from perf group by metric
  ),
  cats as (
    select jsonb_agg(jsonb_build_object('category', coalesce(category,'—'), 'count', c) order by c desc) as j
    from (select category, count(*) c from err where created_at between _from and _to group by category) t
  )
  select jsonb_build_object(
    'comparison', (select j from cmp),
    'daily', coalesce((select j from daily), '[]'::jsonb),
    'series', coalesce((select j from series), '[]'::jsonb),
    'vitals', coalesce((select j from vitals), '[]'::jsonb),
    'errorsByCategory', coalesce((select j from cats), '[]'::jsonb),
    'stats', jsonb_build_object(
      'requests', (select count(*) from apilogs),
      'apiSamples', (select count(*) from apilogs where duration_ms is not null),
      'errorRate', (select case when count(*) > 0 then round(100.0*count(*) filter (where coalesce(status_code,0)>=500)/count(*), 1) else 0 end from apilogs),
      'avg', (select coalesce(round(avg(duration_ms)),0) from apilogs),
      'p50', (select coalesce(round(percentile_cont(0.5) within group (order by duration_ms)),0) from apilogs where duration_ms is not null),
      'p95', (select coalesce(round(percentile_cont(0.95) within group (order by duration_ms)),0) from apilogs where duration_ms is not null),
      'p99', (select coalesce(round(percentile_cont(0.99) within group (order by duration_ms)),0) from apilogs where duration_ms is not null),
      'errors', (select count(*) from err where created_at between _from and _to),
      'criticals', (select count(*) from err where created_at between _from and _to and severity='critical'),
      'unresolved', (select count(*) from err where created_at between _from and _to and coalesce(resolved,false)=false),
      'perfSamples', (select count(*) from perf),
      'sessions', (select count(*) from sess where created_at between _from and _to)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_ops_metrics_v1(timestamptz, timestamptz) from public;
grant execute on function public.get_ops_metrics_v1(timestamptz, timestamptz) to authenticated;