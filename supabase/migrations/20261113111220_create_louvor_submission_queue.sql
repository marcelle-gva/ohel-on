CREATE TABLE IF NOT EXISTS public.louvor_submissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tom text,
  ministro text,
  link_cifra text,
  link_video text,
  palavra_vinculada text,
  status text NOT NULL DEFAULT 'Pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  decidido_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  decidido_em timestamptz,
  louvor_id uuid REFERENCES public.louvores(id) ON DELETE SET NULL,
  CONSTRAINT louvor_submissoes_status_check CHECK (status IN ('Pendente', 'Aprovado', 'Rejeitado'))
);

CREATE INDEX IF NOT EXISTS louvor_submissoes_igreja_status_created_idx
  ON public.louvor_submissoes (igreja_id, status, created_at DESC);

ALTER TABLE public.louvor_submissoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.louvor_submissoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.louvor_submissoes TO service_role;

CREATE OR REPLACE FUNCTION public.decidir_louvor_submissao(
  p_submission_id uuid,
  p_igreja_id uuid,
  p_usuario_id uuid,
  p_decisao text
)
RETURNS TABLE (submissao_id uuid, louvor_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_submissao public.louvor_submissoes%ROWTYPE;
  v_louvor_id uuid;
BEGIN
  IF p_decisao NOT IN ('Aprovado', 'Rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_igreja_id IS NULL OR p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Acesso inválido.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.igreja_id = p_igreja_id
      AND (
        u.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.departamentos d
          WHERE d.igreja_id = p_igreja_id
            AND d.responsavel_usuario_id = p_usuario_id
            AND d.ativo = true
            AND d.nome ILIKE '%louvor%'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Somente o administrador ou o responsável do departamento de Louvor pode revisar.' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_submissao
    FROM public.louvor_submissoes s
   WHERE s.id = p_submission_id
     AND s.igreja_id = p_igreja_id
     AND s.status = 'Pendente'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submissão não encontrada ou já revisada.' USING ERRCODE = 'P0002';
  END IF;

  IF p_decisao = 'Aprovado' THEN
    INSERT INTO public.louvores (
      igreja_id, titulo, tom, ministro, link_cifra, link_video, palavra_vinculada, data
    ) VALUES (
      p_igreja_id,
      v_submissao.titulo,
      v_submissao.tom,
      v_submissao.ministro,
      v_submissao.link_cifra,
      v_submissao.link_video,
      v_submissao.palavra_vinculada,
      CURRENT_DATE
    )
    RETURNING id INTO v_louvor_id;
  END IF;

  UPDATE public.louvor_submissoes s
     SET status = p_decisao,
         decidido_por = p_usuario_id,
         decidido_em = now(),
         louvor_id = v_louvor_id
   WHERE s.id = v_submissao.id;

  RETURN QUERY SELECT v_submissao.id, v_louvor_id, p_decisao;
END;
$function$;

REVOKE ALL ON FUNCTION public.decidir_louvor_submissao(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_louvor_submissao(uuid, uuid, uuid, text) TO service_role;
