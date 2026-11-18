export const EXPENSE_CATEGORIES = [
  { name: 'Alimentação', icon: 'Utensils', color: '#E0835D', bgColor: '#FDF2EB', type: 'expense' as const },
  { name: 'Moradia', icon: 'Home', color: '#3F6253', bgColor: '#EEF3F0', type: 'expense' as const },
  { name: 'Transporte', icon: 'Car', color: '#4B739B', bgColor: '#EEF4F8', type: 'expense' as const },
  { name: 'Lazer & Cultura', icon: 'Sparkles', color: '#C27393', bgColor: '#FDF0F5', type: 'expense' as const },
  { name: 'Saúde & Cuidados', icon: 'HeartPulse', color: '#528F75', bgColor: '#EFF6F2', type: 'expense' as const },
  { name: 'Educação', icon: 'GraduationCap', color: '#88629E', bgColor: '#F5EFF9', type: 'expense' as const },
  { name: 'Serviços & Contas', icon: 'Receipt', color: '#C96846', bgColor: '#FCF1ED', type: 'expense' as const },
  { name: 'Outros', icon: 'MoreHorizontal', color: '#717974', bgColor: '#F4F3F0', type: 'expense' as const },
];

export const DEFAULT_CATEGORIES = [
  ...EXPENSE_CATEGORIES.slice(0, 6),
  { name: 'Salário & Renda', icon: 'Wallet', color: '#437A5B', bgColor: '#EDF5F0', type: 'income' as const },
  ...EXPENSE_CATEGORIES.slice(6),
];

export const PAYMENT_METHODS = [
  'Cartão de Crédito',
  'Conta Corrente',
  'Pix',
  'Dinheiro',
  'Boleto',
] as const;
