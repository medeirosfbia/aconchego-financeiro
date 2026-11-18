import { z } from 'zod';

export const ALLOWED_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Lazer & Cultura',
  'Saúde & Cuidados',
  'Educação',
  'Salário & Renda',
  'Serviços & Contas',
  'Outros',
] as const;

export const ALLOWED_EXPENSE_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Lazer & Cultura',
  'Saúde & Cuidados',
  'Educação',
  'Serviços & Contas',
  'Outros',
] as const;

export const ALLOWED_PAYMENT_METHODS = [
  'Cartão de Crédito',
  'Conta Corrente',
  'Pix',
  'Dinheiro',
  'Boleto',
] as const;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Verifica os magic bytes reais do arquivo decodificado para evitar spoofing de MIME type.
 */
export function detectImageMimeFromMagicBytes(buffer: Buffer): AllowedImageMime | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

const FORBIDDEN_OWNER_KEYS = new Set([
  'userid',
  'user_id',
  'ownerid',
  'owner_id',
  'accountowner',
  'targetuserid',
]);

/**
 * Rejeita explicitamente qualquer tentativa de injetar identificador de usuário ou proprietário
 * nos argumentos gerados pelo modelo de IA.
 */
export function assertNoOwnerOverride(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_OWNER_KEYS.has(key.toLowerCase())) {
      throw new Error(`Parâmetro não autorizado nos argumentos da ferramenta: ${key}`);
    }
  }
}

export const ScanRequestSchema = z.object({
  imageBase64: z.string().min(32).max(12_000_000),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES).optional(),
  todayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const UncertainFieldEnum = z.enum([
  'description',
  'amount',
  'date',
  'category',
  'account',
  'status',
]);

export const ScannedReceiptResponseSchema = z.object({
  isValidDocument: z.boolean(),
  documentType: z.string().default('Documento Financeiro'),
  description: z.string().default(''),
  amount: z.number().nullable().optional().default(0),
  date: z.string().default(''),
  category: z.string().default('Outros'),
  account: z.string().default('Outros'),
  status: z.enum(['paid', 'pending']).default('paid'),
  notes: z.string().default(''),
  confidence: z.enum(['alta', 'media', 'baixa']).default('media'),
  uncertainFields: z.array(UncertainFieldEnum).optional().default([]),
  rejectionReason: z.string().optional(),
});

export type ScannedReceiptModelOutput = z.infer<typeof ScannedReceiptResponseSchema>;

// ------------------------------------------------------------------------------
// Schemas das 11 ferramentas do Agente Financeiro (strict para bloquear campos extras)
// ------------------------------------------------------------------------------

const PeriodSchema = z
  .string()
  .regex(/^(\d{4}-\d{2}|all)$/, 'Período deve ser YYYY-MM ou all');

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');

export const getFinancialSummaryArgsSchema = z
  .object({
    period: PeriodSchema.optional(),
  })
  .strict();

export const listTransactionsArgsSchema = z
  .object({
    period: PeriodSchema.optional(),
    type: z.enum(['all', 'expense', 'income']).optional(),
    category: z.string().max(60).optional(),
    status: z.enum(['all', 'paid', 'pending']).optional(),
    account: z.enum(['all', ...ALLOWED_PAYMENT_METHODS]).optional(),
    search: z.string().max(100).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const proposeCreateTransactionArgsSchema = z
  .object({
    description: z.string().trim().min(2).max(140),
    amount: z.number().positive().max(100_000_000),
    type: z.enum(['expense', 'income']),
    category: z.enum(ALLOWED_CATEGORIES),
    date: IsoDateSchema,
    account: z.enum(ALLOWED_PAYMENT_METHODS),
    status: z.enum(['paid', 'pending']).default('paid'),
    notes: z.string().trim().max(400).optional(),
  })
  .strict();

export const proposeUpdateTransactionArgsSchema = z
  .object({
    transactionId: z.string().trim().min(1).max(120),
    description: z.string().trim().min(2).max(140).optional(),
    amount: z.number().positive().max(100_000_000).optional(),
    type: z.enum(['expense', 'income']).optional(),
    category: z.enum(ALLOWED_CATEGORIES).optional(),
    date: IsoDateSchema.optional(),
    account: z.enum(ALLOWED_PAYMENT_METHODS).optional(),
    status: z.enum(['paid', 'pending']).optional(),
    notes: z.string().trim().max(400).optional(),
  })
  .strict();

export const proposeDeleteTransactionArgsSchema = z
  .object({
    transactionId: z.string().trim().min(1).max(120),
    reason: z.string().trim().max(240).optional(),
  })
  .strict();

export const listBudgetsArgsSchema = z
  .object({
    period: PeriodSchema.optional(),
  })
  .strict();

export const proposeUpdateBudgetArgsSchema = z
  .object({
    category: z.enum(ALLOWED_EXPENSE_CATEGORIES),
    limit: z.number().positive().max(100_000_000),
    period: z.union([z.literal('monthly'), z.string().regex(/^\d{4}-\d{2}$/)]).optional(),
  })
  .strict();

export const listFinancialGoalsArgsSchema = z.object({}).strict();

export const proposeGoalContributionArgsSchema = z
  .object({
    goalId: z.string().trim().min(1).max(120),
    type: z.enum(['deposit', 'withdraw']),
    amount: z.number().positive().max(100_000_000),
    notes: z.string().trim().max(240).optional(),
  })
  .strict();

export const analyzeSpendingArgsSchema = z
  .object({
    period: PeriodSchema.optional(),
  })
  .strict();

export const suggestBudgetPlanArgsSchema = z
  .object({
    monthlyIncome: z.number().positive().max(100_000_000).optional(),
    savingsTargetPercent: z.number().min(5).max(70).optional(),
    period: PeriodSchema.optional(),
  })
  .strict();

export const AgentChatRequestSchema = z.object({
  conversationId: z.string().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(1500),
  currentMonth: z.string().regex(/^(?:\d{4}-(?:0[1-9]|1[0-2])|all)$/).optional(),
  demoState: z
    .object({
      transactions: z.array(z.any()).max(500).optional(),
      budgets: z.array(z.any()).max(100).optional(),
      goals: z.array(z.any()).max(100).optional(),
    })
    .optional(),
});

export const AgentConfirmRequestSchema = z.object({
  operationId: z.string().min(1).max(120),
  action: z.enum(['confirm', 'cancel']),
  idempotencyKey: z.string().min(4).max(120).optional(),
});
