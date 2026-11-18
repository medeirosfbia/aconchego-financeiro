import { CategoryBudget, PiggyBankGoal, Transaction } from '../types/finance.js';

/**
 * Converte um valor monetário em reais para centavos inteiros para evitar erros de ponto flutuante.
 */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Converte centavos inteiros de volta para número em reais com duas casas decimais.
 */
export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Faz o parsing seguro de entradas monetárias brasileiras ("1.250,50", "85,50")
 * ou formato com ponto decimal ("85.50"). Retorna null se inválido ou <= 0 quando allowZero=false.
 */
export function parseCurrencyInput(raw: string, options?: { allowZero?: boolean }): number | null {
  const allowZero = options?.allowZero ?? false;
  const cleaned = (raw ?? '')
    .trim()
    .replace(/R\$\s*/gi, '')
    .replace(/\s+/g, '');

  if (!cleaned) return null;

  let normalized = cleaned;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Ex: 1.250,50 -> remove pontos de milhar, troca vírgula por ponto
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Ex: 1,250.50 -> remove vírgulas de milhar
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else if (hasDot) {
    // Caso "1.000" (3 dígitos após ponto único e sem decimais explícitos) ou "85.50"
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const rounded = fromCents(toCents(parsed));

  if (allowZero ? rounded < 0 : rounded <= 0) {
    return null;
  }

  return rounded;
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: string
): Transaction[] {
  if (!period || period === 'all') return transactions;
  return transactions.filter((t) => typeof t.date === 'string' && t.date.startsWith(period));
}

export interface PeriodFinancialSummary {
  period: string;
  paidIncome: number;
  pendingIncome: number;
  paidExpenses: number;
  pendingExpenses: number;
  monthBalance: number;
  projectedMonthBalance: number;
  globalBalance: number;
  transactionCount: number;
  paidCount: number;
  pendingCount: number;
}

/**
 * Regra contábil explícita:
 * - Somente lançamentos com `status === 'paid'` compõem o saldo efetivado e as despesas pagas.
 * - Lançamentos `pending` são contabilizados separadamente em `pendingIncome` / `pendingExpenses`
 *   e `projectedMonthBalance`, evitando dupla contagem ou desconto prematuro de contas a pagar.
 * - Movimentações internas em cofrinhos (goal_contributions) não entram como despesa aqui.
 */
export function calculatePeriodSummary(
  transactions: Transaction[],
  period: string
): PeriodFinancialSummary {
  const periodTxs = filterTransactionsByPeriod(transactions, period);

  let paidIncomeCents = 0;
  let pendingIncomeCents = 0;
  let paidExpensesCents = 0;
  let pendingExpensesCents = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const tx of periodTxs) {
    const cents = Math.max(0, toCents(tx.amount));
    if (tx.status === 'paid') {
      paidCount += 1;
      if (tx.type === 'income') {
        paidIncomeCents += cents;
      } else {
        paidExpensesCents += cents;
      }
    } else {
      pendingCount += 1;
      if (tx.type === 'income') {
        pendingIncomeCents += cents;
      } else {
        pendingExpensesCents += cents;
      }
    }
  }

  let globalBalanceCents = 0;
  for (const tx of transactions) {
    if (tx.status !== 'paid') continue;
    const cents = Math.max(0, toCents(tx.amount));
    if (tx.type === 'income') {
      globalBalanceCents += cents;
    } else {
      globalBalanceCents -= cents;
    }
  }

  const monthBalanceCents = paidIncomeCents - paidExpensesCents;
  const projectedMonthBalanceCents =
    paidIncomeCents + pendingIncomeCents - (paidExpensesCents + pendingExpensesCents);

  return {
    period,
    paidIncome: fromCents(paidIncomeCents),
    pendingIncome: fromCents(pendingIncomeCents),
    paidExpenses: fromCents(paidExpensesCents),
    pendingExpenses: fromCents(pendingExpensesCents),
    monthBalance: fromCents(monthBalanceCents),
    projectedMonthBalance: fromCents(projectedMonthBalanceCents),
    globalBalance: fromCents(globalBalanceCents),
    transactionCount: periodTxs.length,
    paidCount,
    pendingCount,
  };
}

export interface BudgetStatusItem {
  budget: CategoryBudget;
  spent: number;
  pendingSpent: number;
  remaining: number;
  percent: number;
  isNear: boolean;
  isOver: boolean;
}

/**
 * Seleciona os orçamentos aplicáveis ao período (`period === currentMonth` ou `period === 'monthly'`),
 * priorizando um limite específico do mês caso exista para a mesma categoria.
 */
export function resolveApplicableBudgets(
  budgets: CategoryBudget[],
  period: string
): CategoryBudget[] {
  const byCategory = new Map<string, CategoryBudget>();

  for (const b of budgets) {
    const bPeriod = b.period || 'monthly';
    if (period === 'all') {
      if (!byCategory.has(b.category) || bPeriod === 'monthly') {
        byCategory.set(b.category, b);
      }
      continue;
    }
    if (bPeriod === period) {
      byCategory.set(b.category, b);
    } else if (bPeriod === 'monthly' && !byCategory.has(b.category)) {
      byCategory.set(b.category, b);
    }
  }

  return Array.from(byCategory.values());
}

/**
 * Calcula o consumo de orçamento por categoria usando somente despesas efetivadas (`paid`) para
 * cálculo de estouro/disponível real, mantendo despesas pendentes separadas para transparência.
 */
export function calculateBudgetStatuses(
  budgets: CategoryBudget[],
  transactions: Transaction[],
  period: string
): BudgetStatusItem[] {
  const applicableBudgets = resolveApplicableBudgets(budgets, period);
  const periodExpenses = filterTransactionsByPeriod(transactions, period).filter(
    (t) => t.type === 'expense'
  );

  const paidByCategoryCents = new Map<string, number>();
  const pendingByCategoryCents = new Map<string, number>();

  for (const tx of periodExpenses) {
    const cents = Math.max(0, toCents(tx.amount));
    if (tx.status === 'paid') {
      paidByCategoryCents.set(tx.category, (paidByCategoryCents.get(tx.category) || 0) + cents);
    } else {
      pendingByCategoryCents.set(
        tx.category,
        (pendingByCategoryCents.get(tx.category) || 0) + cents
      );
    }
  }

  return applicableBudgets.map((budget) => {
    const limitCents = Math.max(0, toCents(budget.limit));
    const spentCents = paidByCategoryCents.get(budget.category) || 0;
    const pendingCents = pendingByCategoryCents.get(budget.category) || 0;
    const remainingCents = limitCents - spentCents;
    const percent = limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0;
    const isOver = limitCents > 0 && spentCents > limitCents;
    const isNear = !isOver && percent >= 85;

    return {
      budget,
      spent: fromCents(spentCents),
      pendingSpent: fromCents(pendingCents),
      remaining: fromCents(remainingCents),
      percent,
      isNear,
      isOver,
    };
  });
}

export interface GoalProgressSummary {
  progressPercent: number;
  remainingAmount: number;
  isCompleted: boolean;
}

export function calculateGoalProgress(goal: Pick<PiggyBankGoal, 'currentAmount' | 'targetAmount'>): GoalProgressSummary {
  const currentCents = Math.max(0, toCents(goal.currentAmount));
  const targetCents = Math.max(0, toCents(goal.targetAmount));
  const remainingCents = Math.max(0, targetCents - currentCents);
  const progressPercent =
    targetCents > 0 ? Math.min(100, Math.round((currentCents / targetCents) * 100)) : 0;

  return {
    progressPercent,
    remainingAmount: fromCents(remainingCents),
    isCompleted: targetCents > 0 && currentCents >= targetCents,
  };
}

/**
 * Calcula a aplicação segura de um depósito ou resgate em um cofrinho,
 * rejeitando valores inválidos ou resgate maior que o saldo atual.
 */
export function applyGoalContribution(
  currentAmount: number,
  type: 'deposit' | 'withdraw',
  amount: number
): { ok: true; nextAmount: number } | { ok: false; error: string } {
  const amountCents = toCents(amount);
  const currentCents = Math.max(0, toCents(currentAmount));

  if (!Number.isFinite(amount) || amountCents <= 0) {
    return { ok: false, error: 'Informe um valor válido maior que zero.' };
  }

  if (type === 'withdraw') {
    if (amountCents > currentCents) {
      return {
        ok: false,
        error: `Saldo insuficiente no cofrinho. Disponível para resgate: R$ ${fromCents(currentCents).toFixed(2).replace('.', ',')}.`,
      };
    }
    return { ok: true, nextAmount: fromCents(currentCents - amountCents) };
  }

  return { ok: true, nextAmount: fromCents(currentCents + amountCents) };
}

export interface CategorySpendingBreakdown {
  category: string;
  amount: number;
  pendingAmount: number;
  percent: number;
  transactionCount: number;
}

export function calculateCategorySpending(
  transactions: Transaction[],
  period: string
): CategorySpendingBreakdown[] {
  const expenses = filterTransactionsByPeriod(transactions, period).filter(
    (t) => t.type === 'expense'
  );

  const paidMap = new Map<string, { cents: number; count: number }>();
  const pendingMap = new Map<string, number>();
  let totalPaidCents = 0;

  for (const tx of expenses) {
    const cents = Math.max(0, toCents(tx.amount));
    if (tx.status === 'paid') {
      totalPaidCents += cents;
      const existing = paidMap.get(tx.category) || { cents: 0, count: 0 };
      paidMap.set(tx.category, { cents: existing.cents + cents, count: existing.count + 1 });
    } else {
      pendingMap.set(tx.category, (pendingMap.get(tx.category) || 0) + cents);
    }
  }

  const categories = new Set([...paidMap.keys(), ...pendingMap.keys()]);
  return Array.from(categories)
    .map((category) => {
      const paidInfo = paidMap.get(category) || { cents: 0, count: 0 };
      const pendingCents = pendingMap.get(category) || 0;
      const percent =
        totalPaidCents > 0 ? Math.round((paidInfo.cents / totalPaidCents) * 1000) / 10 : 0;
      return {
        category,
        amount: fromCents(paidInfo.cents),
        pendingAmount: fromCents(pendingCents),
        percent,
        transactionCount: paidInfo.count,
      };
    })
    .sort((a, b) => b.amount - a.amount || b.pendingAmount - a.pendingAmount);
}
