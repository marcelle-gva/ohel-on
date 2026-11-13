#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Nunca usa URL, senha ou host externo: este teste não conhece a produção.
export PGHOST=/var/run/postgresql PGPORT=5432
unset PGDATABASE PGUSER PGPASSWORD PGSERVICE PGOPTIONS
VERSION=$(pg_lsclusters --no-header | awk '$2=="main" && $3==5432 {print $1; exit}')
[[ -n "$VERSION" ]] || { echo 'PostgreSQL local main na porta 5432 não encontrado'; exit 1; }
STARTED=false
if ! sudo -u postgres pg_isready --host=/var/run/postgresql --port=5432 >/dev/null; then
  sudo pg_ctlcluster "$VERSION" main start
  STARTED=true
fi
DB="ohel_test_$$_${RANDOM}"
FIXTURES=$(mktemp -d /tmp/ohel-sql.XXXXXX)
chmod 755 "$FIXTURES"
mkdir -p "$FIXTURES/tests" "$FIXTURES/supabase/migrations"
cp tests/migrations.integration.sql "$FIXTURES/tests/"
cp supabase/migrations/20261113164700_sorteios_vendedores_imagem.sql supabase/migrations/20261113164800_cestas_campanhas_quantidades.sql "$FIXTURES/supabase/migrations/"
chmod 644 "$FIXTURES/tests/"* "$FIXTURES/supabase/migrations/"*
cleanup() {
  sudo -u postgres dropdb --host=/var/run/postgresql --port=5432 --if-exists "$DB" >/dev/null 2>&1
  rm -rf "$FIXTURES"
  if $STARTED; then sudo pg_ctlcluster "$VERSION" main stop; fi
}
trap cleanup EXIT
sudo -u postgres psql -X --host=/var/run/postgresql --port=5432 -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end$$;
SQL
sudo -u postgres createdb --host=/var/run/postgresql --port=5432 "$DB"
sudo -u postgres psql -X --host=/var/run/postgresql --port=5432 -d "$DB" -v ON_ERROR_STOP=1 -f "$FIXTURES/tests/migrations.integration.sql"
