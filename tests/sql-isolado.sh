#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
FIXTURE=${1:?Informe o arquivo SQL fictício em tests/}
[[ "$FIXTURE" == tests/*.sql && -f "$FIXTURE" ]] || { echo 'Fixture inválida'; exit 1; }
export PGHOST=/var/run/postgresql PGPORT=5432
unset PGDATABASE PGUSER PGPASSWORD PGSERVICE PGOPTIONS
VERSION=$(pg_lsclusters --no-header | awk '$2=="main" && $3==5432 {print $1; exit}')
[[ -n "$VERSION" ]] || { echo 'PostgreSQL local main5432 ausente'; exit 1; }
STARTED=false
if ! sudo -u postgres pg_isready --host="$PGHOST" --port="$PGPORT" >/dev/null; then
  sudo pg_ctlcluster "$VERSION" main start
  STARTED=true
fi
DB="ohel_isolado_$$_${RANDOM}"
FILES=$(mktemp -d /tmp/ohel-sql-isolado.XXXXXX)
chmod 755 "$FILES"
mkdir -p "$FILES/tests" "$FILES/supabase/migrations"
cp "$FIXTURE" "$FILES/$FIXTURE"
cp supabase/migrations/*.sql "$FILES/supabase/migrations/"
chmod -R a+rX "$FILES"
cleanup() {
  sudo -u postgres dropdb --host="$PGHOST" --port="$PGPORT" --if-exists "$DB" >/dev/null 2>&1 || true
  rm -rf "$FILES"
  if $STARTED; then sudo pg_ctlcluster "$VERSION" main stop; fi
}
trap cleanup EXIT
sudo -u postgres psql -X --host="$PGHOST" --port="$PGPORT" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END$$;
SQL
sudo -u postgres createdb --host="$PGHOST" --port="$PGPORT" "$DB"
sudo -u postgres psql -X --host="$PGHOST" --port="$PGPORT" -d "$DB" -v ON_ERROR_STOP=1 -f "$FILES/$FIXTURE"
