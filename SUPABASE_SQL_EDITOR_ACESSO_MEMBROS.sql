begin;

-- O pré-cadastro continua público apenas para INSERT com status Pré-Cadastro.
-- Depois de aprovado, o membro autenticado pode consultar somente o próprio registro.
drop policy if exists ohel_membros_active_self_select on public.membros;
create policy ohel_membros_active_self_select
on public.membros
for select
to authenticated
using (
  status = 'Ativo'
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

commit;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'membros'
order by policyname;
