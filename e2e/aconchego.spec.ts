import { test, expect, Page } from '@playwright/test';

function attachConsoleErrorGuard(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon')) {
        errors.push(`console.error: ${txt}`);
      }
    }
  });
  return errors;
}

test.describe('Aconchego Finanças — Testes Ponta a Ponta Reais (Navegador)', () => {
  test('1. Saúde da API, proteção de rotas (/api/agent/chat e /api/receipts/scan) e tela de autenticação', async ({
    page,
    request,
  }) => {
    const errors = attachConsoleErrorGuard(page);

    const healthRes = await request.get('/api/health');
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.ok).toBe(true);
    expect(healthJson.service).toBe('aconchego-financas');

    const unauthAgent = await request.post('/api/agent/chat', {
      data: { message: 'Olá' },
    });
    expect(unauthAgent.status()).toBe(401);

    const unauthScan = await request.post('/api/receipts/scan', {
      data: { imageBase64: 'invalid' },
    });
    expect(unauthScan.status()).toBe(401);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Aconchego Finanças' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar Conta', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recuperar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Explorar em Modo Demonstração/i })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('2. Criação, persistência após recarregar e edição de transação no Modo Demonstração', async ({
    page,
  }) => {
    const errors = attachConsoleErrorGuard(page);

    await page.goto('/');
    await page.getByRole('button', { name: /Explorar em Modo Demonstração/i }).click();
    await expect(page.getByText(/Modo Demonstração ativo/i)).toBeVisible();

    // Criar nova transação
    await page.getByRole('button', { name: /Nova Transação/i }).first().click();
    await page.locator('#tx-amount').fill('85,50');
    await page.locator('#tx-description').fill('Teste E2E Supermercado');
    await page.locator('#tx-category').selectOption('Alimentação');
    await page.locator('#tx-account').selectOption('Pix');
    await page.getByRole('button', { name: 'Adicionar Lançamento' }).click();

    // Ir para o Extrato e confirmar presença
    const desktopNav = page.getByRole('navigation', { name: 'Navegação Principal' });
    await desktopNav.getByRole('button', { name: 'Extrato' }).click();
    await expect(page.getByText('Teste E2E Supermercado')).toBeVisible();

    // Recarregar página e verificar persistência local do modo demo
    await page.reload();
    await page.getByRole('button', { name: /Explorar em Modo Demonstração/i }).click();
    await desktopNav.getByRole('button', { name: 'Extrato' }).click();
    await expect(page.getByText('Teste E2E Supermercado')).toBeVisible();

    // Editar transação
    await page.getByRole('button', { name: 'Editar Teste E2E Supermercado' }).click();
    await page.locator('#tx-description').fill('Teste E2E Editado');
    await page.getByRole('button', { name: 'Salvar Alterações' }).click();
    await expect(page.getByText('Teste E2E Editado')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('3. Orçamentos e Cofrinhos: criação, depósito, retirada validada e atualização visual', async ({
    page,
  }) => {
    const errors = attachConsoleErrorGuard(page);

    await page.goto('/');
    await page.getByRole('button', { name: /Explorar em Modo Demonstração/i }).click();
    const desktopNav = page.getByRole('navigation', { name: 'Navegação Principal' });

    // Orçamento
    await desktopNav.getByRole('button', { name: 'Orçamentos' }).click();
    await page.getByRole('button', { name: 'Novo Limite' }).click();
    await page.locator('#budget-category').selectOption('Educação');
    await page.locator('#budget-limit').fill('900,00');
    await page.getByRole('button', { name: 'Salvar Limite' }).click();
    await expect(page.getByText('Educação')).toBeVisible();

    // Cofrinho
    await desktopNav.getByRole('button', { name: 'Cofrinhos' }).click();
    await page.getByRole('button', { name: 'Criar Cofrinho' }).click();
    await page.locator('#goal-title').fill('Reserva E2E');
    await page.locator('#goal-target').fill('1000,00');
    await page.locator('#goal-current').fill('200,00');
    await page.getByRole('button', { name: 'Salvar Cofrinho' }).click();
    await expect(page.getByRole('heading', { name: 'Reserva E2E' })).toBeVisible();

    // Depósito no cofrinho recém-criado (último botão Guardar)
    const goalCard = page.locator('div.rounded-2xl', { hasText: 'Reserva E2E' }).first();
    await goalCard.getByRole('button', { name: 'Guardar' }).click();
    await page.getByPlaceholder('0,00').fill('150,00');
    await page.getByRole('button', { name: 'Confirmar Depósito' }).click();
    await expect(goalCard.getByText('R$ 350,00')).toBeVisible();

    // Tentativa de resgate maior que o saldo deve bloquear
    await goalCard.getByRole('button', { name: 'Resgatar' }).click();
    await page.getByPlaceholder('0,00').fill('9999,00');
    await page.getByRole('button', { name: 'Confirmar Resgate' }).click();
    await expect(page.getByRole('alert')).toContainText(/Saldo insuficiente/i);

    // Resgate válido
    await page.getByPlaceholder('0,00').fill('50,00');
    await page.getByRole('button', { name: 'Confirmar Resgate' }).click();
    await expect(goalCard.getByText('R$ 300,00')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('4. Responsividade Mobile (375x812) sem overflow horizontal e com barra inferior funcional', async ({
    page,
  }) => {
    const errors = attachConsoleErrorGuard(page);
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/');
    await page.getByRole('button', { name: /Explorar em Modo Demonstração/i }).click();

    const mobileNav = page.getByRole('navigation', { name: 'Navegação Principal Mobile' });
    await expect(mobileNav).toBeVisible();

    await mobileNav.getByRole('button', { name: 'Agente' }).click();
    await expect(page.getByRole('heading', { name: /Assistente Financeiro IA/i })).toBeVisible();

    await mobileNav.getByRole('button', { name: 'Escanear' }).click();
    await expect(page.getByRole('heading', { name: /Escanear Recibo ou Conta/i })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    expect(hasHorizontalOverflow).toBe(false);
    expect(errors).toEqual([]);
  });

});
