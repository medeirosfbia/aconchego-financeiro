# Guia de Implantação (Supabase + Vercel) — Aconchego Finanças

## 1. Pré-requisitos

- Conta no [Supabase](https://supabase.com) com um projeto PostgreSQL criado.
- Chave válida da API Gemini ([Google AI Studio](https://aistudio.google.com/apikey)).
- Conta na [Vercel](https://vercel.com) conectada ao repositório GitHub.

## 2. Configuração do Supabase

### 2.1 Aplicar Migrations
Execute as migrations versionadas em ordem cronológica:
1. [`supabase/migrations/20261117000001_initial_schema.sql`](../supabase/migrations/20261117000001_initial_schema.sql) — schema relacional inicial, triggers, RLS e buckets privados.
2. [`supabase/migrations/20261118000002_security_advisors_hardening.sql`](../supabase/migrations/20261118000002_security_advisors_hardening.sql) — `SET search_path = public` nas funções, índices adicionais de chaves estrangeiras e políticas RLS otimizadas com `(select auth.uid())`.

- **Via Supabase CLI:**
  ```bash
  npx supabase link --project-ref SEU_PROJECT_REF
  # Confira o histórico e use migration up com alvo remoto explícito conforme sua versão do CLI.
  ```
- **Via SQL Editor (Painel Supabase):**
  Cole e execute primeiro `20261117000001_initial_schema.sql` e em seguida `20261118000002_security_advisors_hardening.sql`.

Verifique após executar:
1. As 10 tabelas existem no schema `public` com RLS ativado.
2. Os buckets privados `receipts` e `goal-images` aparecem em **Storage → Buckets** com `Public = false`.

### 2.2 URLs de Redirecionamento e SMTP Próprio
1. Em **Authentication → URL Configuration**, adicione:
   - `Site URL`: URL de produção/preview na Vercel (`https://seu-app.vercel.app`)
   - `Redirect URLs`: `http://localhost:3000/**` e `https://seu-app.vercel.app/**`
2. Para uso público contínuo, configure um provedor SMTP dedicado em **Authentication → SMTP Settings** (Resend, Postmark, SendGrid ou SES), pois o SMTP padrão do Supabase limita drasticamente envios por hora. **Não** desative a confirmação de e-mail como atalho.

## 3. Variáveis de Ambiente

Configure localmente em `.env` (a partir de [`.env.example`](../.env.example)) e no painel **Settings → Environment Variables** da Vercel:

| Variável | Visibilidade | Obrigatória | Descrição |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Pública (build Vite + API) | Sim | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Pública (build Vite + API) | Sim | Publishable / Anon Key do Supabase |
| `GEMINI_API_KEY` | **Privada (Servidor)** | Sim | Chave da Gemini API (nunca prefixar com `VITE_`) |
| `GEMINI_MODEL` | **Privada (Servidor)** | Recomendada | Modelo Gemini (ex: `gemini-2.5-flash`) |
| `APP_URL` | Servidor | Recomendada | URL pública da aplicação |

## 4. Publicação na Vercel

O arquivo [`vercel.json`](../vercel.json) e a função serverless [`api/[...route].ts`](../api/[...route].ts) já configuram:
- Build estático do Vite para `dist/` (`npm run build`).
- Roteamento de `/api/*` para a Vercel Function Express (`api/[...route].ts`).
- Fallback SPA para `index.html` em todas as rotas de navegador.

Passos no painel da Vercel:
1. Importe o repositório `RHU4N/aconchego-financeiro` (fork de evolução do original `medeirosfbia/aconchego-financeiro`).
2. Mantenha **Framework Preset: Vite**, **Build Command: `npm run build`** e **Output Directory: `dist`**.
3. Cadastre as 5 variáveis de ambiente para **Production** e **Preview**.
4. Gere primeiro um **Preview Deployment** e valide os critérios de segurança, banco e IA antes de promover para produção.

### Estado auditado em 18/11/2026

- Projeto existente: `rhu4ns-projects/aconchego-financeiro`, ligado ao fork `RHU4N/aconchego-financeiro`; Production Branch `main`, raiz do repositório, Vite, build `npm run build`, saída `dist`.
- As cinco variáveis essenciais existem separadamente em Production e Preview. URL Supabase de Production corresponde a `fhrmqspsxnodlftunsfa`, modelo `gemini-flash-lite-latest` e APP_URL `https://aconchego-financeiro-zeta.vercel.app`. Segredos não são copiados entre ambientes.
- Três migrations aplicadas, incluindo `20261118034542_atomic_agent_confirmation.sql`, autorizada especificamente. TaskMind não foi acessado.
- Login e integrações foram validados com contas sintéticas e JWT comum. Cadastro/recuperação via e-mail e SMTP dedicado continuam sem validação de ponta a ponta.
- IA sem login demo desativada por padrão; `ENABLE_DEMO_AI` é opcional e deve permanecer falso para uso público.
- Para publicar, construa para Production sem atribuir domínios, valide e promova essa mesma build. Resultado e URL final em [RELEASE.md](RELEASE.md).
