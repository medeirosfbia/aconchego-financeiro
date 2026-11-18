import { CategoryBudget, PiggyBankGoal, Transaction } from '../types/finance';
import { GOAL_BEACH_URL, GOAL_RESERVE_URL, RECEIPT_SAMPLE_URL } from '../utils/assets';
import { getCurrentYearMonth } from '../utils/formatters';
import { DEFAULT_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from './categories';

export { DEFAULT_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS };

export const DEFAULT_BUDGETS: CategoryBudget[] = [
  { category: 'Alimentação', limit: 1400, period: 'monthly', icon: 'Utensils', color: '#E0835D', bgColor: '#FDF2EB' },
  { category: 'Moradia', limit: 2200, period: 'monthly', icon: 'Home', color: '#3F6253', bgColor: '#EEF3F0' },
  { category: 'Transporte', limit: 600, period: 'monthly', icon: 'Car', color: '#4B739B', bgColor: '#EEF4F8' },
  { category: 'Lazer & Cultura', limit: 450, period: 'monthly', icon: 'Sparkles', color: '#C27393', bgColor: '#FDF0F5' },
  { category: 'Saúde & Cuidados', limit: 400, period: 'monthly', icon: 'HeartPulse', color: '#528F75', bgColor: '#EFF6F2' },
  { category: 'Serviços & Contas', limit: 550, period: 'monthly', icon: 'Receipt', color: '#C96846', bgColor: '#FCF1ED' },
];

export const INITIAL_GOALS: PiggyBankGoal[] = [
  {
    id: 'demo-goal-1',
    title: 'Viagem de Férias para a Praia',
    targetAmount: 3500,
    currentAmount: 2450,
    targetDate: '2026-12-20',
    imageUrl: GOAL_BEACH_URL,
    notes: 'Passagens e pousada em Ubatuba para recarregar as energias com a família.',
    color: '#3F6253',
    contributions: [
      {
        id: 'demo-contrib-1',
        goalId: 'demo-goal-1',
        type: 'deposit',
        amount: 2000,
        notes: 'Reserva inicial das férias (exemplo)',
        createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      },
      {
        id: 'demo-contrib-2',
        goalId: 'demo-goal-1',
        type: 'deposit',
        amount: 450,
        notes: 'Aporte mensal (exemplo)',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
    ],
  },
  {
    id: 'demo-goal-2',
    title: 'Reserva de Emergência (6 Meses)',
    targetAmount: 12000,
    currentAmount: 8400,
    targetDate: '2027-03-01',
    imageUrl: GOAL_RESERVE_URL,
    notes: 'Tranquilidade e segurança para imprevistos.',
    color: '#437A5B',
    contributions: [
      {
        id: 'demo-contrib-3',
        goalId: 'demo-goal-2',
        type: 'deposit',
        amount: 8400,
        notes: 'Aporte acumulado (exemplo)',
        createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      },
    ],
  },
  {
    id: 'demo-goal-3',
    title: 'Novo Notebook para Trabalho',
    targetAmount: 4800,
    currentAmount: 1600,
    targetDate: '2027-01-15',
    imageUrl: '',
    notes: 'Substituir laptop antigo para mais agilidade nos projetos.',
    color: '#E0835D',
    contributions: [
      {
        id: 'demo-contrib-4',
        goalId: 'demo-goal-3',
        type: 'deposit',
        amount: 1600,
        notes: 'Reserva para equipamento (exemplo)',
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      },
    ],
  },
];

export function buildDemoTransactions(now: Date = new Date()): Transaction[] {
  const currYM = getCurrentYearMonth(now);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = getCurrentYearMonth(prevDate);
  const baseTs = now.getTime();

  return [
    {
      id: 'demo-tx-1',
      description: 'Salário Mensal CLT (Exemplo)',
      amount: 5400.0,
      type: 'income',
      category: 'Salário & Renda',
      date: `${currYM}-05`,
      account: 'Conta Corrente',
      status: 'paid',
      notes: 'Depósito demonstrativo do mês corrente.',
      createdAt: baseTs - 86400000 * 2,
    },
    {
      id: 'demo-tx-2',
      description: 'Supermercado Mensal Pão de Açúcar',
      amount: 542.8,
      type: 'expense',
      category: 'Alimentação',
      date: `${currYM}-06`,
      account: 'Cartão de Crédito',
      status: 'paid',
      imageUrl: RECEIPT_SAMPLE_URL,
      notes: 'Compras de exemplo: hortifrúti fresco, grãos e produtos de limpeza.',
      createdAt: baseTs - 86400000 * 1,
    },
    {
      id: 'demo-tx-3',
      description: 'Aluguel & Condomínio',
      amount: 1850.0,
      type: 'expense',
      category: 'Moradia',
      date: `${currYM}-05`,
      account: 'Pix',
      status: 'paid',
      notes: 'Comprovante enviado para a imobiliária.',
      createdAt: baseTs - 86400000 * 2,
    },
    {
      id: 'demo-tx-4',
      description: 'Projeto Freelance de Design UX',
      amount: 1200.0,
      type: 'income',
      category: 'Salário & Renda',
      date: `${currYM}-04`,
      account: 'Pix',
      status: 'paid',
      notes: 'Entrega final da landing page para cliente.',
      createdAt: baseTs - 86400000 * 3,
    },
    {
      id: 'demo-tx-5',
      description: 'Feira Orgânica e Frutas',
      amount: 88.5,
      type: 'expense',
      category: 'Alimentação',
      date: `${currYM}-04`,
      account: 'Pix',
      status: 'paid',
      notes: 'Bananas, maçãs, folhas e ovos caipiras.',
      createdAt: baseTs - 86400000 * 3,
    },
    {
      id: 'demo-tx-6',
      description: 'Conta de Energia (Enel)',
      amount: 168.4,
      type: 'expense',
      category: 'Serviços & Contas',
      date: `${currYM}-03`,
      account: 'Boleto',
      status: 'pending',
      notes: 'Conta em aberto para pagamento no vencimento.',
      createdAt: baseTs - 86400000 * 4,
    },
    {
      id: 'demo-tx-7',
      description: 'Abastecimento Carro Posto Shell',
      amount: 210.0,
      type: 'expense',
      category: 'Transporte',
      date: `${currYM}-02`,
      account: 'Cartão de Crédito',
      status: 'paid',
      notes: 'Etanol comum.',
      createdAt: baseTs - 86400000 * 5,
    },
    {
      id: 'demo-tx-8',
      description: 'Café da Tarde & Livraria',
      amount: 46.0,
      type: 'expense',
      category: 'Lazer & Cultura',
      date: `${currYM}-01`,
      account: 'Cartão de Crédito',
      status: 'paid',
      notes: 'Cappuccino com pão de queijo.',
      createdAt: baseTs - 86400000 * 6,
    },
    {
      id: 'demo-tx-9',
      description: 'Internet Fibra Óptica 500MB',
      amount: 119.9,
      type: 'expense',
      category: 'Serviços & Contas',
      date: `${currYM}-01`,
      account: 'Cartão de Crédito',
      status: 'paid',
      createdAt: baseTs - 86400000 * 6,
    },
    {
      id: 'demo-tx-10',
      description: 'Farmácia & Vitaminas',
      amount: 125.3,
      type: 'expense',
      category: 'Saúde & Cuidados',
      date: `${prevYM}-28`,
      account: 'Cartão de Crédito',
      status: 'paid',
      createdAt: baseTs - 86400000 * 9,
    },
    {
      id: 'demo-tx-11',
      description: 'Cinema de Fim de Semana',
      amount: 72.0,
      type: 'expense',
      category: 'Lazer & Cultura',
      date: `${prevYM}-27`,
      account: 'Cartão de Crédito',
      status: 'paid',
      createdAt: baseTs - 86400000 * 10,
    },
  ];
}

export const INITIAL_TRANSACTIONS: Transaction[] = buildDemoTransactions();

export const SAMPLE_RECEIPT_LINKS = [
  {
    title: 'Cupom de Supermercado (Exemplo Local)',
    url: RECEIPT_SAMPLE_URL,
    description: 'Recibo impresso em mesa de madeira com iluminação natural',
  },
  {
    title: 'Recibo de Exemplo (Web 1)',
    url: 'https://images.unsplash.com/photo-1554415707-9e4466759538?auto=format&fit=crop&w=800&q=80',
    description: 'Comprovante com café e caneta',
  },
  {
    title: 'Cupom Fiscal / Café (Web 2)',
    url: 'https://images.unsplash.com/photo-1556742049-0a67e557224f?auto=format&fit=crop&w=800&q=80',
    description: 'Pagamento e café aconchegante',
  },
];
