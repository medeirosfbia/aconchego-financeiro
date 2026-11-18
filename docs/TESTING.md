# Estratégia e Resultados de Testes — Aconchego Finanças

## 1. Suíte Automatizada e E2E

A suíte utiliza **Vitest**, **Testing Library (`@testing-library/react`, `jsdom`)**, **Supertest** e **Playwright (`@playwright/test`)**, executada com:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

Para executar o Playwright contra o Preview da Vercel protegido por Deployment Protection SSO, defina:
```bash
PLAYWRIGHT_BASE_URL=https://aconchego-financeiro-2si5igpjy-rhu4ns-projects.vercel.app
VERCEL_BYPASS_TOKEN=seu_token_de_automacao_vercel
npm run test:e2e
```

## 2. Cobertura e resultados em 18/11/2026

| Suíte | Resultado | Evidência |
|---|---|---|
| Vitest | 32/32 | Matemática (9), schemas (6), API com mocks (12), interface (5) |
| Playwright | 5/5 | Quatro fluxos demo/API/mobile e um fluxo completo real |
| PostgreSQL local | Aprovado | Confirmação, duplicidade, rollback, CRUD, orçamento, saldo, RLS e caminho de recibo |
| Build e TypeScript | Aprovados | `npm run build` e `npm run lint` |

## 3. Integrações reais e limites

O arquivo `e2e/live-integrations.spec.ts` requer configuração pública do Supabase e `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD` no ambiente local ignorado. Use somente contas sintéticas confirmadas e diferentes.

O teste usa login real na interface, grava/edita/remove transações, verifica reload, orçamento e cofrinhos, chama Gemini real para resumo e proposta, exige confirmação e verifica concorrência (200/409). O scanner apresenta prévia editável antes de salvar; a imagem privada é inacessível à conta B e a anônimos. A limpeza remove apenas fixtures dessa execução, via JWT do usuário A. A chave administrativa serve exclusivamente para criar as contas, nunca para acessar dados financeiros.

Sem essas contas o teste é ignorado com **NÃO VALIDADO**. CI não recebe senhas e roda quatro testes demo com um teste real ignorado. Traces, vídeos, screenshots e snapshots automáticos ficam desativados no teste real para proteger credenciais.

A suíte SQL `supabase/tests/financial_integrity.sql` deve rodar apenas em PostgreSQL local descartável com as migrations aplicadas. Os papéis de teste assumem `authenticated` e tudo termina com `ROLLBACK`. Foi executada com PostgreSQL embarcado PGlite, com stubs locais de Auth e Storage; não representa validação de login Supabase.

**NÃO VALIDADOS:** entrega SMTP, cadastro público, recuperação de senha e chamadas reais das outras nove ferramentas Gemini. Consulte o resultado de produção em [RELEASE.md](RELEASE.md).

## 4. Integração Contínua (GitHub Actions)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) executa automaticamente em cada `push` e `pull_request` na branch `main`:
1. `npm ci --no-audit --no-fund`
2. `npm run lint` (`tsc --noEmit`)
3. `npm test` (`vitest run`)
4. `npm run build` (`vite build`)
5. Instalação Chromium e `npm run test:e2e` (sem credenciais externas).
