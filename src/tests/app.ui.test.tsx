import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { AuthView } from '../components/AuthView';
import {
  DemoFinanceRepository,
  FinanceRepository,
  LoadedFinanceData,
} from '../services/financeRepository';
import { CategoryBudget, PiggyBankGoal, Transaction } from '../types/finance';
import { getCurrentYearMonth } from '../utils/formatters';

function createEmptyTestRepository(): FinanceRepository {
  let txs: Transaction[] = [];
  let budgets: CategoryBudget[] = [];
  let goals: PiggyBankGoal[] = [];

  return {
    isDemo: false,
    async loadAll(): Promise<LoadedFinanceData> {
      return {
        profile: {
          id: 'real-user-1',
          email: 'maria@exemplo.com',
          fullName: 'Maria Silva',
        },
        transactions: txs,
        budgets,
        goals,
        importedHashes: [],
      };
    },
    async saveTransaction(input) {
      const saved: Transaction = {
        id: input.id || `tx-${Date.now()}`,
        description: input.description,
        amount: input.amount,
        type: input.type,
        category: input.category,
        date: input.date,
        account: input.account,
        status: input.status,
        imageUrl: input.imageUrl,
        notes: input.notes,
        createdAt: Date.now(),
      };
      txs = [saved, ...txs];
      return saved;
    },
    async deleteTransaction(id) {
      txs = txs.filter((t) => t.id !== id);
    },
    async toggleTransactionStatus(tx) {
      const next: Transaction = {
        ...tx,
        status: tx.status === 'paid' ? 'pending' : 'paid',
      };
      txs = txs.map((t) => (t.id === tx.id ? next : t));
      return next;
    },
    async saveBudget(budget) {
      budgets = [...budgets, budget];
      return budget;
    },
    async deleteBudget(budget) {
      budgets = budgets.filter((b) => b.category !== budget.category);
    },
    async saveGoal(goal) {
      goals = [...goals, goal];
      return goal;
    },
    async deleteGoal(id) {
      goals = goals.filter((g) => g.id !== id);
    },
    async contributeToGoal(goalId, type, amount) {
      const g = goals.find((item) => item.id === goalId)!;
      const updated: PiggyBankGoal = {
        ...g,
        currentAmount: type === 'deposit' ? g.currentAmount + amount : g.currentAmount - amount,
      };
      goals = goals.map((item) => (item.id === goalId ? updated : item));
      return {
        goal: updated,
        contribution: {
          id: 'c1',
          goalId,
          type,
          amount,
          createdAt: new Date().toISOString(),
        },
      };
    },
    async checkReceiptDuplicate() {
      return false;
    },
    async loadAgentHistory() {
      return { conversations: [], messages: [], operations: [] };
    },
  };
}

describe('Fluxos de Interface — Aconchego Finanças', () => {
  it('exibe tela de autenticação com login, cadastro, recuperação e Modo Demonstração voluntário', () => {
    const onDemo = vi.fn();
    render(<AuthView onEnterDemoMode={onDemo} />);

    expect(screen.getByText('Aconchego Finanças')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar Conta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recuperar' })).toBeInTheDocument();

    const demoBtn = screen.getByRole('button', { name: /Explorar em Modo Demonstração/i });
    fireEvent.click(demoBtn);
    expect(onDemo).toHaveBeenCalledTimes(1);
  });

  it('conta autenticada nova inicia vazia (sem importar dados fictícios) e usa mês dinâmico', async () => {
    const emptyRepo = createEmptyTestRepository();
    render(<App injectedRepository={emptyRepo} />);

    await waitFor(() => {
      expect(screen.getByText(/Olá, Maria!/i)).toBeInTheDocument();
    });

    // Não deve conter dados fictícios de initialData nem saudação fixa "Olá, Bia!"
    expect(screen.queryByText(/Olá, Bia!/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Salário Mensal CLT/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum lançamento cadastrado ainda/i)).toBeInTheDocument();

    const monthSelect = screen.getByLabelText('Selecionar período') as HTMLSelectElement;
    expect(monthSelect.value).toBe(getCurrentYearMonth());
  });

  it('Modo Demonstração voluntário carrega dados de exemplo, permite navegar pelas 7 abas e usar scanner com revisão humana', async () => {
    const demoRepo = new DemoFinanceRepository();
    render(<App initialDemoMode={true} injectedRepository={demoRepo} />);

    await waitFor(() => {
      expect(screen.getByText(/Modo Demonstração ativo/i)).toBeInTheDocument();
    });

    // Verifica que todas as 7 abas principais existem e navegam corretamente
    const mainNav = screen.getByRole('navigation', { name: 'Navegação Principal' });
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Extrato' }));
    expect(screen.getByText('Extrato de Lançamentos')).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: 'Orçamentos' }));
    expect(screen.getByText('Orçamentos por Categoria')).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: 'Cofrinhos' }));
    expect(screen.getByText('Cofrinhos & Metas dos Sonhos')).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: /Comprovantes/i }));
    expect(screen.getByText('Galeria de Comprovantes & Recibos')).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: 'Assistente IA' }));
    expect(screen.getByText('Assistente Financeiro IA')).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: 'Escanear' }));
    expect(screen.getByText('Escanear Recibo ou Conta')).toBeInTheDocument();
  });

  it('scanner exige revisão e confirmação humana antes de salvar a despesa', async () => {
    const emptyRepo = createEmptyTestRepository();

    // Mock global fetch para /api/receipts/scan
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          documentType: 'Cupom Fiscal',
          description: 'Padaria do Bairro',
          amount: 24.5,
          date: getCurrentYearMonth() + '-15',
          category: 'Alimentação',
          account: 'Pix',
          status: 'paid',
          notes: 'Café da manhã',
          confidence: 'alta',
          uncertainFields: ['account'],
          fileHash: 'hash-teste-123',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    // Mock de Image/Canvas simples em jsdom para compressBlobToJpeg
    const OriginalImage = globalThis.Image;
    class MockImage {
      width = 400;
      height = 300;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    );

    try {
      render(<App injectedRepository={emptyRepo} />);
      await waitFor(() => expect(screen.getByText(/Olá, Maria!/i)).toBeInTheDocument());

      const mainNav = screen.getByRole('navigation', { name: 'Navegação Principal' });
      fireEvent.click(within(mainNav).getByRole('button', { name: 'Escanear' }));

      const user = userEvent.setup();
      const fileInput = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
      const file = new File(['dummy'], 'cupom.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      // Aguarda aparecer a prévia editável (SEM ter salvo ainda!)
      await waitFor(
        () => {
          expect(screen.getByText(/Revise os dados lidos antes de registrar/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      // Aviso e selo de revisão exibidos para o campo incerto
      expect(screen.getAllByText('Pendente de revisão').length).toBeGreaterThanOrEqual(2);
      // Antes de confirmar, 0 transações salvas
      expect((await emptyRepo.loadAll()).transactions).toHaveLength(0);

      // Agora confirma explicitamente
      fireEvent.click(screen.getByRole('button', { name: /Confirmar e Salvar Despesa/i }));

      await waitFor(() => {
        expect(screen.getByText(/Despesa confirmada e salva/i)).toBeInTheDocument();
      });
      expect((await emptyRepo.loadAll()).transactions).toHaveLength(1);
    } finally {
      globalThis.Image = OriginalImage;
      fetchMock.mockRestore();
    }
  });

  it('Assistente IA exibe sugestões obrigatórias, cartão de confirmação humana e executa proposta confirmada', async () => {
    const emptyRepo = createEmptyTestRepository();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversationId: 'conv-1',
            reply: 'Posso registrar esta compra de R$ 85,50 no Supermercado via Pix. Confirma?',
            toolTraces: [
              {
                name: 'proposeCreateTransaction',
                args: { description: 'Supermercado', amount: 85.5 },
              },
            ],
            operationProposals: [
              {
                id: 'op-ui-1',
                operationType: 'create_transaction',
                status: 'pending_confirmation',
                title: 'Novo lançamento: Supermercado',
                summary: 'Despesa de R$ 85,50 em Alimentação (Pix)',
                arguments: {
                  description: 'Supermercado',
                  amount: 85.5,
                  type: 'expense',
                  category: 'Alimentação',
                  date: getCurrentYearMonth() + '-17',
                  account: 'Pix',
                  status: 'paid',
                },
                idempotencyKey: 'idem-ui-1',
                createdAt: new Date().toISOString(),
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operation: {
              id: 'op-ui-1',
              operationType: 'create_transaction',
              status: 'executed',
              title: 'Novo lançamento: Supermercado',
              summary: 'Despesa de R$ 85,50 em Alimentação (Pix)',
              arguments: {
                description: 'Supermercado',
                amount: 85.5,
              },
              idempotencyKey: 'idem-ui-1',
              createdAt: new Date().toISOString(),
              executedAt: new Date().toISOString(),
            },
            mutatedData: {},
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    try {
      render(<App injectedRepository={emptyRepo} />);
      await waitFor(() => expect(screen.getByText(/Olá, Maria!/i)).toBeInTheDocument());

      const mainNav = screen.getByRole('navigation', { name: 'Navegação Principal' });
      fireEvent.click(within(mainNav).getByRole('button', { name: 'Assistente IA' }));

      // Clica no prompt sugerido
      fireEvent.click(
        screen.getAllByText(/Registre uma compra de R\$ 85,50 no supermercado, paga no Pix\./i)[0]
      );

      await waitFor(() => {
        expect(screen.getByText('Novo lançamento: Supermercado')).toBeInTheDocument();
      });

      expect(screen.getByText('Aguardando confirmação')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Confirmar e Executar/i }));

      await waitFor(() => {
        expect(screen.getByText('Confirmada')).toBeInTheDocument();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
