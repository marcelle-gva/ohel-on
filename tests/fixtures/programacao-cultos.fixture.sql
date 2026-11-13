-- Fixture descartável para testes locais: não aponta para o Supabase do projeto.
CREATE TEMP TABLE fixture_igrejas (id uuid PRIMARY KEY);
CREATE TEMP TABLE fixture_usuarios (id uuid PRIMARY KEY, igreja_id uuid NOT NULL, role text NOT NULL);
CREATE TEMP TABLE fixture_culto_tipos (id uuid PRIMARY KEY, igreja_id uuid NOT NULL, nome text NOT NULL, ativo boolean NOT NULL DEFAULT true);
CREATE TEMP TABLE fixture_culto_modelos (
  id uuid PRIMARY KEY,
  igreja_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  dia_semana smallint NOT NULL,
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  vigencia_desde timestamptz NOT NULL
);
CREATE TEMP TABLE fixture_culto_sessoes (
  id uuid PRIMARY KEY,
  igreja_id uuid NOT NULL,
  modelo_id uuid,
  titulo text NOT NULL,
  tipo text NOT NULL,
  inicio_em timestamptz NOT NULL,
  fim_em timestamptz,
  status text NOT NULL
);
CREATE TEMP TABLE fixture_programacoes_cultos_anuais (
  id uuid PRIMARY KEY,
  igreja_id uuid NOT NULL,
  ano smallint NOT NULL,
  data_culto date NOT NULL,
  titulo text NOT NULL,
  tipo text NOT NULL,
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true
);
INSERT INTO fixture_igrejas VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO fixture_usuarios VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin');
INSERT INTO fixture_culto_tipos VALUES ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Culto Especial', true);
