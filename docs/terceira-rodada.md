# Histórico de Cultos e Culto no Lar

## Programação fixa

Em **Monitor de Mídia → Histórico de Cultos**, o administrador pode editar nome, tipo, dia da semana e horário de uma programação já cadastrada. O formulário distingue cadastro de edição e oferece **Cancelar edição**. Horário final deve ser posterior ao início; horários ativos sobrepostos são recusados também no banco. Pausar e reativar continuam disponíveis.

A edição é transacional: sincroniza as ocorrências usando os valores antigos antes de alterar o modelo e reinicia sua vigência. Diários anteriores e a sessão em andamento são preservados. Alterar um modelo individual não renomeia os cultos antigos. A ação separada de renomear um *tipo* mantém o comportamento existente e também atualiza esse tipo na agenda anual.

## Programação anual

O mesmo Histórico possui o espaço **Programação anual**, com seleção de ano, data, título, tipo, início, fim e observações. O administrador pode cadastrar, editar, cancelar e reativar datas planejadas da própria igreja. A agenda anual é pontual e separada dos horários semanais: cadastrar uma data não inicia automaticamente uma sessão de culto nem duplica um diário existente. A abertura do culto continua pelos fluxos atuais.

## Culto no Lar para membros

O dashboard tem um cartão **Culto no Lar → Abrir mural e enviar**, e o menu pessoal oferece o mesmo acesso em `/area-membro/culto-no-lar`.

**Mural da igreja** mostra somente envios aprovados. **Meus envios** mostra os registros do próprio membro, seu status e, quando houver rejeição, a orientação da liderança. **Compartilhar encontro** recebe casa/família, data, Palavra ministrada e uma foto; título e referência bíblica são opcionais. Não é necessário informar endereço e a interface orienta a não incluir localização pessoal. Há confirmação explícita de autorização de imagem, incluindo responsável quando retratar crianças/adolescentes.

Novo envio nasce **Pendente**, independentemente de dados enviados pelo navegador. Editar um envio próprio, inclusive aprovado, o devolve a **Pendente**, exigindo nova aprovação. A foto é opcional na edição: sem substituição, mantém-se a atual. Falhas preservam os campos para nova tentativa; o servidor recusa alterações com uma versão desatualizada.

## Aprovação pela liderança

O administrador e o grupo **Liderança** com autorização de edição/aprovação no Mural ou nos módulos de oração existentes podem revisar. Cargo e departamento declarados não concedem essa autorização. Membros da liderança podem usar a aba **Revisão da liderança** dentro da própria área pessoal, mesmo sem acesso ao Monitor de Mídia.

Há também **Secretaria → Culto no Lar · revisão** em `/secretaria/mural/culto-no-lar`, respeitando o acesso ao módulo Mural e a regra adicional de moderação. O Histórico oferece um atalho à revisão para quem tem acesso ao Mural. A fila tem filtros de status, Palavra completa, foto, versão e ações de aprovar/rejeitar. A rejeição pode incluir orientação privada ao autor. Uma decisão não pode aprovar conteúdo alterado em outra aba: a versão exibida é validada atomicamente e o histórico da decisão fica privado.

## Privacidade e limites

A publicação é para os membros ativos da **mesma igreja**, não para visitantes da internet. Antes da aprovação, somente autor e liderança autorizada consultam texto e foto. Identidade, igreja e permissões vêm da sessão Supabase, não de campos do formulário.

Fotos JPEG, PNG e WebP são validadas no servidor, com máximo de 4 MiB para reservar margem ao restante do formulário na implantação original. A imagem é redecodificada e gravada sem metadados EXIF/GPS. O bucket `culto-lar-fotos` é privado, com acesso direto bloqueado para `anon` e `authenticated`. A API entrega bytes apenas depois de revalidar o acesso ao registro; não envia caminhos de Storage nem URLs públicas ou assinadas. A interface usa URLs Blob temporárias, revogadas ao sair/perder autorização, com atualização periódica e por foco. Como qualquer foto exibida, alguém autorizado ainda pode salvá-la ou fazer captura de tela.

A integração preserva os recursos anteriores de sorteios, oração, finanças, cestas, perfil e cuidado pastoral. Não foram usadas contas ou informações pessoais reais para testes. A execução autenticada ponta a ponta com contas reais não é uma evidência desta entrega: o sandbox não possui a chave privada Supabase do servidor.

## Migrações e verificação

As migrações principais são `20261113172500_programacao_cultos_edicao_anual.sql` e `20261113172600_culto_no_lar.sql`, complementadas por `20261113174300_programacao_cultos_privilegios.sql`. As três foram validadas e reaplicadas em PostgreSQL 16 local descartável, com fixtures fictícias e sem DSN externo; bancos e arquivos temporários foram removidos. Após os testes e a revisão, foram aplicadas com sucesso no Supabase de produção em 13/11/2026, sem executar fixtures ou consultar dados pessoais reais.

A suite final passou com 73 testes, TypeScript sem erros, build de produção aprovado e lint focado em 23 arquivos sem erros (1 aviso anterior sobre imagem). A revisão somente leitura encontrou dois ajustes: impedir leitura de envios privados após reatribuição de conta de um membro e preservar o editor anual quando a data muda para outro ano. Ambos foram corrigidos e receberam regressões executáveis sobre o helper e o componente reais. O manifesto completo contém 129 páginas.

O teste SQL também reproduz os grants explícitos de `ALTER DEFAULT PRIVILEGES` do Supabase. A conferência de metadados de produção confirmou RLS, agenda com somente leitura autenticada (sem escrita direta ou TRUNCATE), RPCs novas sem execução anônima, helper interno não acessível ao cliente e Culto no Lar/fotos restritos ao servidor autorizado.

A publicação original foi confirmada em 13/11/2026: GitHub `fb05cdf60b6646377e17a4a06503508d49e3c27e`, status Vercel **success — Deployment has completed**, implantação `https://vercel.com/marcellegva-1782/ohel-on/Gh49Q3ZhdBd1QUuLy1Xbt5TQmLQv`. No domínio oficial `https://www.ipocloud.com.br`, manifesto HTTP 200 idêntico com 129 páginas, Histórico/área pessoal/revisão HTTP 200 e GET/POST `/api/culto-lar` sem token HTTP 401. Nenhuma conta ou publicação pessoal real foi criada para conferir os fluxos. Nenhuma cópia pública Manus foi publicada.
