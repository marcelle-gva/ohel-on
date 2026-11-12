begin;

-- Não consulte auth.users dentro de policies: authenticated não tem SELECT
-- nessa tabela. O e-mail assinado do usuário já está no JWT do Supabase.
drop policy if exists ohel_cestas_select_membro on public.cestas_basicas;
create policy ohel_cestas_select_membro
  on public.cestas_basicas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.igreja_id = cestas_basicas.igreja_id
    )
    or exists (
      select 1
      from public.membros m
      where m.igreja_id = cestas_basicas.igreja_id
        and lower(m.email) = lower((select auth.jwt() ->> 'email'))
        and m.status = 'Ativo'
    )
  );

drop policy if exists ohel_cesta_itens_select_membro on public.cesta_itens;
create policy ohel_cesta_itens_select_membro
  on public.cesta_itens
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.igreja_id = cesta_itens.igreja_id
        and u.role in ('admin', 'pastor', 'secretaria')
    )
    or (
      exists (
        select 1
        from public.cestas_basicas c
        where c.id = cesta_itens.cesta_id
          and c.igreja_id = cesta_itens.igreja_id
          and c.status = 'aberta'
      )
      and exists (
        select 1
        from public.membros m
        where m.igreja_id = cesta_itens.igreja_id
          and lower(m.email) = lower((select auth.jwt() ->> 'email'))
          and m.status = 'Ativo'
      )
    )
  );

drop policy if exists ohel_cesta_doacoes_member_select on public.cesta_doacoes;
create policy ohel_cesta_doacoes_member_select
  on public.cesta_doacoes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.membros m
      where m.id = cesta_doacoes.membro_id
        and lower(m.email) = lower((select auth.jwt() ->> 'email'))
        and m.status = 'Ativo'
    )
  );

commit;
