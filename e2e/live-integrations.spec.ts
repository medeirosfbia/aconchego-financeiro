import crypto from 'node:crypto';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';

const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY',
  'E2E_USER_A_EMAIL', 'E2E_USER_A_PASSWORD', 'E2E_USER_B_EMAIL', 'E2E_USER_B_PASSWORD'];
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

// Tokens e senhas de teste não devem aparecer em traces ou screenshots de falha.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.describe('Integrações reais — contas sintéticas, RLS e Gemini', () => {
  test('login, CRUD persistente, orçamento, cofrinho, scanner, agente e isolamento', async ({ page, request }) => {
    test.skip(required.some(k => !process.env[k]?.trim()), 'NÃO VALIDADO: faltam duas contas sintéticas confirmadas e configuração Supabase.');
    test.setTimeout(180_000);
    const marker = `E2E ${crypto.randomUUID()}`;
    const url = process.env.VITE_SUPABASE_URL!;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const client = () => createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const a = client(), b = client();
    const login = async (client: SupabaseClient, label: string) => {
      const { data, error } = await client.auth.signInWithPassword({
        email:process.env[`E2E_USER_${label}_EMAIL`]!, password:process.env[`E2E_USER_${label}_PASSWORD`]!,
      });
      expect(error?.code).toBeUndefined();
      expect(Boolean(data.session)).toBe(true);
      return data.session!;
    };
    const sessionA = await login(a,'A');
    const sessionB = await login(b,'B');
    expect(sessionA.user.id === sessionB.user.id).toBe(false);
    const headers = { Authorization:`Bearer ${sessionA.access_token}` };
    let goalId: string | undefined, budgetId: string | undefined;
    let receiptPath: string | undefined, receiptId: string | undefined;
    const conversationIds = new Set<string>();
    try {
      await page.goto('/');
      await page.locator('#auth-email').fill(process.env.E2E_USER_A_EMAIL!);
      await page.locator('#auth-password').fill(process.env.E2E_USER_A_PASSWORD!);
      await page.getByRole('button',{name:'Entrar no Aconchego',exact:true}).click();
      await expect(page.getByRole('button',{name:'Nova Transação'}).first()).toBeVisible();
      await expect(page.getByText(/Modo Demonstração ativo/i)).toHaveCount(0);
      await page.getByRole('button',{name:'Nova Transação'}).first().click();
      await page.locator('#tx-description').fill(marker);
      await page.locator('#tx-amount').fill('85,50');
      await page.locator('#tx-category').selectOption('Alimentação');
      await page.locator('#tx-account').selectOption('Pix');
      await page.getByRole('button',{name:'Adicionar Lançamento'}).click();
      const nav = page.getByRole('navigation',{name:'Navegação Principal',exact:true});
      await nav.getByRole('button',{name:'Extrato',exact:true}).click();
      await expect(page.getByText(marker,{exact:true})).toBeVisible();
      await page.reload();
      await nav.getByRole('button',{name:'Extrato',exact:true}).click();
      await expect(page.getByText(marker,{exact:true})).toBeVisible();
      await page.getByRole('button',{name:`Editar ${marker}`,exact:true}).click();
      await page.locator('#tx-amount').fill('90,00');
      await page.getByRole('button',{name:'Salvar Alterações'}).click();
      await expect.poll(async () => (await a.from('transactions').select('amount').eq('description',marker).single()).data?.amount).toBe(90);
      const tx = await a.from('transactions').select('id').eq('description',marker).single();
      expect(tx.error?.code).toBeUndefined();
      expect((await b.from('transactions').select('id').eq('id',tx.data!.id)).data).toEqual([]);
      expect((await b.from('transactions').update({amount:1}).eq('id',tx.data!.id).select('id')).data).toEqual([]);

      await nav.getByRole('button',{name:'Orçamentos',exact:true}).click();
      await page.getByRole('button',{name:'Novo Limite'}).click();
      await page.locator('#budget-category').selectOption('Educação');
      await page.locator('#budget-limit').fill('900,00');
      await page.getByRole('button',{name:'Salvar Limite'}).click();
      await expect(page.getByText('Educação',{exact:true})).toBeVisible();
      const budget = await a.from('budgets').select('id,limit_amount').eq('category','Educação').single();
      budgetId = budget.data?.id;
      expect(budget.data?.limit_amount).toBe(900);

      await nav.getByRole('button',{name:'Cofrinhos',exact:true}).click();
      await page.getByRole('button',{name:'Criar Cofrinho',exact:true}).click();
      await page.locator('#goal-title').fill(marker);
      await page.locator('#goal-target').fill('1000,00');
      await page.locator('#goal-current').fill('0,00');
      await page.getByRole('button',{name:'Salvar Cofrinho'}).click();
      const goalCard = page.locator('div.rounded-2xl',{hasText:marker}).first();
      await goalCard.getByRole('button',{name:'Guardar',exact:true}).click();
      await page.getByPlaceholder('0,00').fill('200,00');
      await page.getByRole('button',{name:'Confirmar Depósito'}).click();
      await expect(goalCard.getByText('R$ 200,00',{exact:true})).toBeVisible();
      await goalCard.getByRole('button',{name:'Resgatar',exact:true}).click();
      await page.getByPlaceholder('0,00').fill('999,00');
      await page.getByRole('button',{name:'Confirmar Resgate'}).click();
      await expect(page.getByRole('alert')).toContainText('Saldo insuficiente');
      await page.getByPlaceholder('0,00').fill('50,00');
      await page.getByRole('button',{name:'Confirmar Resgate'}).click();
      await expect(goalCard.getByText('R$ 150,00',{exact:true})).toBeVisible();
      const goal = await a.from('financial_goals').select('id,current_amount').eq('title',marker).single();
      goalId = goal.data?.id;
      expect(goal.data?.current_amount).toBe(150);
      const overdraw = await a.from('goal_contributions').insert({user_id:sessionA.user.id,goal_id:goalId,type:'withdraw',amount:999});
      expect(Boolean(overdraw.error)).toBe(true);

      // Gemini real lê apenas os dados retornados pelo JWT de A.
      const summary = await request.post('/api/agent/chat',{headers,data:{message:'Use getFinancialSummary para consultar meu resumo financeiro deste mês.',currentMonth:new Date().toISOString().slice(0,7)}});
      expect(summary.status()).toBe(200);
      const summaryData = await summary.json();
      conversationIds.add(summaryData.conversationId);
      expect(summaryData.toolTraces.some((t: any) => t.name==='getFinancialSummary')).toBe(true);

      const proposal = await request.post('/api/agent/chat',{headers,data:{message:`Registre uma despesa de R$ 12,34 em Alimentação, paga no Pix hoje, com descrição exata "${marker} agente". Crie a proposta agora usando proposeCreateTransaction.`,currentMonth:new Date().toISOString().slice(0,7)}});
      expect(proposal.status()).toBe(200);
      const proposalData = await proposal.json();
      conversationIds.add(proposalData.conversationId);
      expect(proposalData.operationProposals.length).toBe(1);
      const operation = proposalData.operationProposals[0];
      expect(operation.status).toBe('pending_confirmation');
      expect((await a.from('transactions').select('id').eq('idempotency_key',operation.idempotencyKey)).data).toEqual([]);
      const foreignConfirm = await request.post('/api/agent/confirm',{headers:{Authorization:`Bearer ${sessionB.access_token}`},data:{operationId:operation.id,action:'confirm'}});
      expect(foreignConfirm.status()).toBe(404);
      const confirmations = await Promise.all([1,2].map(() => request.post('/api/agent/confirm',{headers,data:{operationId:operation.id,action:'confirm'}})));
      expect(confirmations.map(r=>r.status()).sort()).toEqual([200,409]);
      expect((await a.from('transactions').select('id').eq('idempotency_key',operation.idempotencyKey)).data?.length).toBe(1);

      await nav.getByRole('button',{name:'Escanear',exact:true}).click();
      await page.locator('input[type="file"]:not([capture])').setInputFiles(path.resolve('src/assets/images/receipt_supermarket_sample_1791335311360.jpg'));
      await expect(page.locator('#scan-desc')).toBeVisible({timeout:40_000});
      await page.locator('#scan-desc').fill(`${marker} scanner`);
      await page.locator('#scan-amount').fill('25,00');
      expect((await a.from('transactions').select('id').eq('description',`${marker} scanner`)).data).toEqual([]);
      await page.getByRole('button',{name:'Confirmar e Salvar Despesa'}).click();
      await expect.poll(async () => (await a.from('transactions').select('amount').eq('description',`${marker} scanner`).single()).data?.amount).toBe(25);
      const scanTx = await a.from('transactions').select('receipt_id').eq('description',`${marker} scanner`).single();
      receiptId = scanTx.data?.receipt_id;
      const receipt = await a.from('receipts').select('storage_path').eq('id',receiptId).single();
      receiptPath = receipt.data?.storage_path;
      expect(Boolean(receiptPath?.startsWith(sessionA.user.id+'/'))).toBe(true);
      expect(Boolean((await a.storage.from('receipts').download(receiptPath!)).data)).toBe(true);
      expect(Boolean((await b.storage.from('receipts').download(receiptPath!)).error)).toBe(true);
      const anon = client();
      expect((await anon.from('transactions').select('id')).data).toEqual([]);
      expect(Boolean((await anon.storage.from('receipts').download(receiptPath!)).error)).toBe(true);
      expect((await b.from('receipts').select('id').eq('id',receiptId)).data).toEqual([]);
      await a.from('transactions').delete().eq('id',tx.data!.id);
      expect((await a.from('transactions').select('id').eq('id',tx.data!.id)).data).toEqual([]);
    } finally {
      // Somente fixtures identificadas desta execução, sempre sob o JWT de A.
      await a.from('transactions').delete().like('description',`${marker}%`);
      if(receiptId) await a.from('receipts').delete().eq('id',receiptId);
      if(receiptPath) await a.storage.from('receipts').remove([receiptPath]);
      if(goalId) await a.from('financial_goals').delete().eq('id',goalId);
      if(budgetId) await a.from('budgets').delete().eq('id',budgetId);
      for(const id of conversationIds) await a.from('agent_conversations').delete().eq('id',id);
      await a.auth.signOut(); await b.auth.signOut();
    }
  });
});
