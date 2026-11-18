# Auditoria de release — 18/11/2026

Origem: `feat/finalizacao-cloud-e2e`, fork `RHU4N/aconchego-financeiro`. O original de Beatriz Medeiros Faria permanece a base e mantém sua autoria no histórico.

## Evidências de qualidade

- `npm ci`, TypeScript, 32 testes Vitest e build aprovados.
- Cinco E2E aprovados, incluindo duas contas sintéticas com login real, persistência após reload, edição/exclusão, orçamento, depósitos/resgates, prévia do scanner, Storage privado, Gemini real e confirmação concorrente (200/409).
- Ferramentas efetivamente chamadas com Gemini: `getFinancialSummary` e `proposeCreateTransaction`. As outras nove não receberam validação real nesta auditoria.
- Projeto Supabase: `RHU4N's Project`, `fhrmqspsxnodlftunsfa`; três migrations registradas. A terceira foi aplicada após autorização específica. TaskMind não foi consultado.
- RLS ativo nas dez tabelas; buckets `receipts` e `goal-images` privados. A RPC de confirmação é `SECURITY INVOKER`, sem EXECUTE anônimo.
- Contas de teste foram criadas pela API Auth administrativa; toda validação financeira usou publishable key e JWT comum. Senhas de teste foram rotacionadas e sessões anteriores revogadas após exposição em diagnóstico de uma falha. Capturas sensíveis foram desativadas.

## Achados e correções

1. **Alta — confirmação não atômica, corrigida.** Antes, `agent_operations` podia ficar executada sem a mutação financeira. `src/server/dataStore.ts` agora chama `confirm_agent_operation`; a migration `20261118034542_atomic_agent_confirmation.sql` usa bloqueio de linha e uma transação única, mantendo RLS. Rollback foi validado em PostgreSQL local; concorrência foi validada por HTTP com Supabase real.
2. **Média — acesso público à cota Gemini, corrigido.** O token demo conhecido não autoriza mais consumo da IA por padrão (`src/server/authMiddleware.ts`). A ativação exige `ENABLE_DEMO_AI=true`.
3. **Média — referências entre contas e histórico, corrigidos.** Políticas restritivas verificam a conversa/operação vinculada e o diretório do recibo; contribuições não podem ser apagadas isoladamente.
4. **Média — exposição de erros internos, corrigida.** JSON malformado retorna erro genérico; falhas de provedor não retornam sua mensagem bruta nem payloads em logs (`src/server/app.ts`, `receiptScanner.ts`, `agentService.ts`).
5. **Validação enganosa, corrigida.** O teste anterior chamado Auth real usava sessão demo. O novo `e2e/live-integrations.spec.ts` usa duas contas reais e diferencia testes ignorados de aprovados. CI usa `npm ci` e executa Playwright sem segredos.

## Limitações restantes

- Security Advisor: um WARN por proteção contra senhas vazadas desativada; sem erros de schema. Consulte [a orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Cadastro, recuperação, entrega de e-mails e SMTP dedicado não foram validados de ponta a ponta.
- Rate limiting é local à instância. Storage e escrita relacional não compõem uma transação distribuída; falhas parciais podem deixar órfãos. Saldo inicial de cofrinho é separado do histórico de contribuições.
- Testes SQL em `supabase/tests/financial_integrity.sql` são exclusivamente locais; não executar em banco remoto.

## Publicação

Projeto existente `rhu4ns-projects/aconchego-financeiro`, Vite, raiz do repositório, build `npm run build`, saída `dist`, branch de Production `main`.

Domínio de Production configurado: [aconchego-financeiro-zeta.vercel.app](https://aconchego-financeiro-zeta.vercel.app). O domínio só constitui evidência de release após a validação HTTP e E2E do deployment de Production. Os identificadores finais, resultado do CI e PR são fornecidos na entrega da auditoria.
