import { describe, it, expect } from 'vitest';
import {
  addMoney,
  applyGoalContribution,
  calculateBudgetStatuses,
  calculateCategorySpending,
  calculateGoalProgress,
  calculatePeriodSummary,
  fromCents,
  parseCurrencyInput,
  subtractMoney,
  toCents,
} from '../utils/financeMath';
import {
  formatCurrency,
  formatDate,
  formatFriendlyDate,
  getCurrentYearMonth,
  getMonthLabel,
} from '../utils/formatters';
import { CategoryBudget, PiggyBankGoal, Transaction } from '../types/finance';

describe('financeMath — precisão monetária em centavos', () => {
  it('evita erro clássico de ponto flutuante (0.1 + 0.2 === 0.3)', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(subtractMoney(100.1, 0.05)).toBe(100.05);
    expect(toCents(85.5)).toBe(8550);
    expect(fromCents(8550)).toBe(85.5);
  });

  it('interpreta formatos brasileiros e rejeita entradas inválidas ou <= 0', () => {
    expect(parseCurrencyInput('85,50')).toBe(85.5);
    expect(parseCurrencyInput('R$ 1.250,75')).toBe(1250.75);
    expect(parseCurrencyInput('1250.75')).toBe(1250.75);
    expect(parseCurrencyInput('0')).toBeNull();
    expect(parseCurrencyInput('0', { allowZero: true })).toBe(0);
    expect(parseCurrencyInput('-50')).toBeNull();
    expect(parseCurrencyInput('abc')).toBeNull();
    expect(parseCurrencyInput('')).toBeNull();
  });
});

describe('financeMath — receitas, despesas e regra contábil pendente vs efetivado', () => {
  const sampleTxs: Transaction[] = [
    {
      id: '1',
      description: 'Salário',
      amount: 5000,
      type: 'income',
      category: 'Salário & Renda',
      date: '2026-11-05',
      account: 'Conta Corrente',
      status: 'paid',
      createdAt: 1,
    },
    {
      id: '2',
      description: 'Supermercado',
      amount: 542.8,
      type: 'expense',
      category: 'Alimentação',
      date: '2026-11-06',
      account: 'Pix',
      status: 'paid',
      createdAt: 2,
    },
    {
      id: '3',
      description: 'Conta de Luz (Em aberto)',
      amount: 220.4,
      type: 'expense',
      category: 'Serviços & Contas',
      date: '2026-11-10',
      account: 'Boleto',
      status: 'pending',
      createdAt: 3,
    },
    {
      id: '4',
      description: 'Despesa mês anterior',
      amount: 100,
      type: 'expense',
      category: 'Transporte',
      date: '2026-10-20',
      account: 'Cartão de Crédito',
      status: 'paid',
      createdAt: 4,
    },
  ];

  it('não trata despesa pendente como paga nem desconta duas vezes', () => {
    const summary = calculatePeriodSummary(sampleTxs, '2026-11');
    expect(summary.paidIncome).toBe(5000);
    expect(summary.paidExpenses).toBe(542.8);
    expect(summary.pendingExpenses).toBe(220.4);
    expect(summary.monthBalance).toBe(4457.2);
    expect(summary.projectedMonthBalance).toBe(4236.8);
    // Saldo geral efetivado inclui mês anterior pago (5000 - 542.8 - 100 = 4357.2)
    // e não desconta a conta pendente de 220.4
    expect(summary.globalBalance).toBe(4357.2);

    // Ao efetivar a conta pendente, ela sai de pendingExpenses e entra uma única vez em paidExpenses
    const afterPaid = sampleTxs.map((t) =>
      t.id === '3' ? { ...t, status: 'paid' as const } : t
    );
    const updatedSummary = calculatePeriodSummary(afterPaid, '2026-11');
    expect(updatedSummary.pendingExpenses).toBe(0);
    expect(updatedSummary.paidExpenses).toBe(763.2);
    expect(updatedSummary.globalBalance).toBe(4136.8);
  });

  it('retorna zeros coerentes quando não há dados cadastrados', () => {
    const emptySummary = calculatePeriodSummary([], '2026-11');
    expect(emptySummary.paidIncome).toBe(0);
    expect(emptySummary.paidExpenses).toBe(0);
    expect(emptySummary.pendingExpenses).toBe(0);
    expect(emptySummary.monthBalance).toBe(0);
    expect(emptySummary.globalBalance).toBe(0);
    expect(emptySummary.transactionCount).toBe(0);
  });
});

describe('financeMath — orçamentos e alertas sem falsos positivos', () => {
  const budgets: CategoryBudget[] = [
    {
      category: 'Alimentação',
      limit: 1000,
      period: 'monthly',
      icon: 'Utensils',
      color: '#E0835D',
      bgColor: '#FDF2EB',
    },
    {
      category: 'Transporte',
      limit: 500,
      period: '2026-11',
      icon: 'Car',
      color: '#4B739B',
      bgColor: '#EEF4F8',
    },
  ];

  const txs: Transaction[] = [
    {
      id: 't1',
      description: 'Mercado',
      amount: 1150,
      type: 'expense',
      category: 'Alimentação',
      date: '2026-11-05',
      account: 'Pix',
      status: 'paid',
      createdAt: 1,
    },
    {
      id: 't2',
      description: 'Combustível',
      amount: 430,
      type: 'expense',
      category: 'Transporte',
      date: '2026-11-08',
      account: 'Cartão de Crédito',
      status: 'paid',
      createdAt: 2,
    },
    {
      id: 't3',
      description: 'Estacionamento pendente',
      amount: 100,
      type: 'expense',
      category: 'Transporte',
      date: '2026-11-09',
      account: 'Boleto',
      status: 'pending',
      createdAt: 3,
    },
  ];

  it('calcula utilizado, pendente, restante, alerta de proximidade (>=85%) e estouro', () => {
    const statuses = calculateBudgetStatuses(budgets, txs, '2026-11');
    const food = statuses.find((s) => s.budget.category === 'Alimentação')!;
    const transport = statuses.find((s) => s.budget.category === 'Transporte')!;

    expect(food.spent).toBe(1150);
    expect(food.remaining).toBe(-150);
    expect(food.percent).toBe(115);
    expect(food.isOver).toBe(true);
    expect(food.isNear).toBe(false);

    // Transporte pago = 430 de 500 (86% -> perto do limite, sem falso estouro pela pendente de 100)
    expect(transport.spent).toBe(430);
    expect(transport.pendingSpent).toBe(100);
    expect(transport.remaining).toBe(70);
    expect(transport.percent).toBe(86);
    expect(transport.isNear).toBe(true);
    expect(transport.isOver).toBe(false);
  });

  it('ranqueia despesas por categoria corretamente', () => {
    const breakdown = calculateCategorySpending(txs, '2026-11');
    expect(breakdown[0].category).toBe('Alimentação');
    expect(breakdown[0].amount).toBe(1150);
    expect(breakdown[1].category).toBe('Transporte');
    expect(breakdown[1].amount).toBe(430);
  });
});

describe('financeMath — cofrinhos e movimentações', () => {
  it('calcula percentual de progresso e valor restante sem estourar 100%', () => {
    const goal: PiggyBankGoal = {
      id: 'g1',
      title: 'Viagem de Férias',
      targetAmount: 3500,
      currentAmount: 2450,
      color: '#3F6253',
    };
    const prog = calculateGoalProgress(goal);
    expect(prog.progressPercent).toBe(70);
    expect(prog.remainingAmount).toBe(1050);
    expect(prog.isCompleted).toBe(false);
  });

  it('impede resgate maior que o saldo disponível e valores negativos', () => {
    const invalidZero = applyGoalContribution(500, 'deposit', 0);
    expect(invalidZero.ok).toBe(false);

    const overWithdraw = applyGoalContribution(200, 'withdraw', 350);
    expect(overWithdraw.ok).toBe(false);

    const validWithdraw = applyGoalContribution(200, 'withdraw', 150);
    expect(validWithdraw).toEqual({ ok: true, nextAmount: 50 });

    const validDeposit = applyGoalContribution(200, 'deposit', 100.55);
    expect(validDeposit).toEqual({ ok: true, nextAmount: 300.55 });
  });
});

describe('formatters — datas, períodos e moeda', () => {
  it('gera ano-mês dinâmico em vez de mês fixo', () => {
    const refDate = new Date(2026, 10, 17); // Novembro de 2026 (mês 0-based = 10)
    expect(getCurrentYearMonth(refDate)).toBe('2026-11');
    expect(getMonthLabel('2026-11')).toBe('Novembro de 2026');
    expect(formatDate('2026-11-17')).toBe('17/11/2026');
    expect(formatFriendlyDate('2026-11-17', refDate)).toBe('Hoje');
    expect(formatFriendlyDate('2026-11-16', refDate)).toBe('Ontem');
    expect(formatCurrency(85.5)).toContain('85,50');
  });
});
