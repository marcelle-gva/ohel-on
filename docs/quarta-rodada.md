# Quarta rodada — orações e financeiro

A implementação segue a ordem autorizada, com publicação verificada no site original ao final de cada etapa. Arquitetura e cadastros existentes são preservados; nenhuma conta, saldo, oração ou registro pessoal real é usado como fixture.

## Etapa inicial — orações

A auditoria rastreou pedidos atuais, moderação, dashboard administrativo, Monitor, dashboard de membro, notificações, Mural de comunicações, projeção e diário histórico. Encontrou exclusão cuja resposta de erro/linha afetada era ignorada; consultas da lista e do Monitor podiam terminar fora de ordem. Isso permite falsa confirmação ou exibição obsoleta. Não há caminho de reinserção no trigger de culto: o diário guarda snapshots após inserção/edição, sem recriar pedidos excluídos.

Exclusão e edição passam a conferir sessão, igreja, erro e linha afetada, mantendo o RLS atual. Só uma exclusão confirmada remove o pedido; leitura posterior utiliza uma sequência nova, e erros de consulta não são mostrados como lista vazia ou contagem zero. A lista é lida em páginas de 500, sem truncar o histórico. Logout/invalidação limpa os dados locais.

O endpoint legado de Monitor agora exige os mesmos filtros de igreja, status aprovado, visibilidade pública e janela recente das demais superfícies de publicação. Uma migração aditiva restringe leitura direta de pedidos não publicados e snapshots privados à gestão autorizada; o QR Code continua enviando pedidos pendentes/públicos, sem permitir aprovação forjada na inserção anônima. Não altera conteúdo existente nem a aprovação pela Liderança.

O KPI administrativo inclui pendentes/em oração; o feed compartilhado mostra somente públicos aprovados dos últimos sete dias. O Mural de comunicações não é uma segunda tabela de pedidos. Notificações aprovadas têm histórico sem a mesma janela recente. O diário foi rotulado explicitamente como histórico: preservar seu snapshot não significa restaurar o pedido ativo.

Sem o ID da ocorrência relatada, não é possível atribuir a causa ao registro específico nem afirmar que foi uma duplicata. A correção resolve os bugs demonstrados, sem apagar o pedido real da usuária para investigar.

Evidências em 13/11/2026: 90 testes isolados aprovados, TypeScript e build de produção aprovados. Migração executada e reaplicada em PostgreSQL 16 descartável e aplicada em produção com `success: true`; as três policies restritivas foram conferidas por metadados. Revisão somente leitura concluída; troca de sessão no Monitor e seleção de cultos fora de ordem foram corrigidas e revalidadas. Lint dos demais arquivos da etapa limpo; no Monitor permanecem exatamente os sete erros de `any` e quatro avisos de imagem anteriores, sem diagnósticos novos. O envio à Vercel será confirmado antes de iniciar o Financeiro.

Teste autenticado ponta a ponta não executado no sandbox, que não possui a chave privada do servidor Supabase; testes executáveis usam clientes e dados fictícios. Nenhum conteúdo real de oração foi usado para testar ou apagado na investigação.
