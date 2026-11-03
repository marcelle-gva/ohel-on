begin;

-- Vínculo seguro entre o registro da igreja e a conta do Supabase Auth.
alter table public.membros
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists membros_auth_user_id_unique
  on public.membros(auth_user_id)
  where auth_user_id is not null;

create index if not exists membros_email_igreja_idx
  on public.membros(igreja_id, lower(email));

-- O membro só pode consultar o próprio registro depois da aprovação.
drop policy if exists ohel_membros_active_self_select on public.membros;
create policy ohel_membros_active_self_select
on public.membros
for select
to authenticated
using (
  status = 'Ativo'
  and (
    auth_user_id = auth.uid()
    or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

commit;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'membros'
  and column_name = 'auth_user_id';
