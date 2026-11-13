# Sorteios administrativos: fotos e IA opcional

O painel em `/sorteios/:id` permite ao administrador enviar uma foto do prêmio ou solicitar uma geração manual. O upload é validado no servidor por assinatura real (JPEG, PNG ou WebP) e tamanho máximo de 8 MB, salvo no bucket Supabase público já autorizado `cartazes`, sob o caminho isolado da igreja e do sorteio.

A geração só ocorre após o clique em **IA gerar foto (opcional)**. O endpoint consulta `ListModels`, usa um modelo atualmente disponível e envia ao ImageService apenas o nome/descrição do prêmio sanitizados, sem comprador, vendedor, telefone, e-mail ou outros registros de participantes. O resultado é baixado/decodificado, validado e persistido no Storage antes de atualizar `sorteios.cartaz_url`. Falhas não substituem a foto anterior.

## Configuração no servidor

Configure no ambiente server-side da Vercel (Preview/Production conforme o projeto), como variáveis secretas e nunca como `NEXT_PUBLIC_*`:

- `MANUS_API_URL`: base URL do runtime Service API.
- `MANUS_API_KEY`: credencial server-side do projeto para o ImageService.

O Sandbox pode fornecer essas variáveis durante o desenvolvimento. Não copie valores do Sandbox para o repositório nem para o frontend; cadastre as credenciais correspondentes no ambiente protegido da Vercel. Se alguma variável estiver ausente, o botão retorna erro explicativo e não simula sucesso.

O endpoint mantém um cooldown de um minuto por administrador e sorteio. Não há chamada automática, fila ou geração em montagem da página.

## Migration necessária

Aplicar posteriormente, em janela controlada, `supabase/migrations/20261113164700_sorteios_vendedores_imagem.sql`. A migration é aditiva e idempotente: cria vínculo de vendedor, origem e estado de pagamento manual, trigger de proteção para usuários não administradores e a RPC atômica `registrar_numero_manual_sorteio`. Ela não insere transações, contas a pagar ou qualquer lançamento financeiro.
