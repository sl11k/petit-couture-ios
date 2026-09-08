create or replace view public.admin_customers
with (security_invoker = on) as
with order_stats as (
  select lower(o.customer_email) as email_key,
         count(*)::int as orders_count,
         count(*) filter (where o.payment_status in ('paid','captured','succeeded'))::int as paid_orders_count,
         coalesce(sum(o.total) filter (where o.payment_status in ('paid','captured','succeeded')), 0)::numeric as total_spent,
         max(o.created_at) as last_order_at,
         min(o.created_at) as first_order_at,
         (array_agg(o.customer_name order by o.created_at desc) filter (where o.customer_name is not null))[1] as any_name,
         (array_agg(o.customer_phone order by o.created_at desc) filter (where o.customer_phone is not null))[1] as any_phone
  from public.orders o
  where o.customer_email is not null and o.customer_email <> ''
  group by 1
),
reg as (
  select p.id, p.user_id, p.full_name, p.email, p.phone, p.created_at,
         lower(coalesce(p.email, '')) as email_key
  from public.profiles p
)
select r.id,
       r.user_id,
       coalesce(nullif(r.full_name, ''), s.any_name) as full_name,
       r.email,
       coalesce(nullif(r.phone, ''), s.any_phone) as phone,
       r.created_at,
       true as has_account,
       coalesce(s.orders_count, 0) as orders_count,
       coalesce(s.paid_orders_count, 0) as paid_orders_count,
       coalesce(s.total_spent, 0) as total_spent,
       s.last_order_at
from reg r
left join order_stats s on s.email_key = r.email_key
union all
select (md5(s.email_key))::uuid as id,
       null::uuid as user_id,
       s.any_name as full_name,
       s.email_key as email,
       s.any_phone as phone,
       s.first_order_at as created_at,
       false as has_account,
       s.orders_count,
       s.paid_orders_count,
       s.total_spent,
       s.last_order_at
from order_stats s
where not exists (select 1 from reg r where r.email_key = s.email_key);

grant select on public.admin_customers to authenticated;
grant select on public.admin_customers to service_role;