import { describe, it, expect } from 'vitest';
import {
  ScannedReceiptResponseSchema,
  AgentChatRequestSchema,
  assertNoOwnerOverride,
  detectImageMimeFromMagicBytes,
  listTransactionsArgsSchema,
  proposeCreateTransactionArgsSchema,
  proposeDeleteTransactionArgsSchema,
  proposeGoalContributionArgsSchema,
  proposeUpdateBudgetArgsSchema,
  proposeUpdateTransactionArgsSchema,
} from '../server/schemas';

describe('Validação de MIME type real por magic bytes', () => {
  it('identifica JPEG, PNG e WebP reais', () => {
    const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(detectImageMimeFromMagicBytes(jpegBuf)).toBe('image/jpeg');

    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
    ]);
    expect(detectImageMimeFromMagicBytes(pngBuf)).toBe('image/png');

    const webpBuf = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'ascii');
    expect(detectImageMimeFromMagicBytes(webpBuf)).toBe('image/webp');
  });

  it('rejeita arquivo texto/HTML/SVG disfarçado de imagem', () => {
    const fakeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8');
    expect(detectImageMimeFromMagicBytes(fakeSvg)).toBeNull();

    const tiny = Buffer.from([0x01, 0x02]);
    expect(detectImageMimeFromMagicBytes(tiny)).toBeNull();
  });
});

describe('Validação de schemas do Scanner e das ferramentas do Agente', () => {
  it('valida o mês inteiro sem aceitar prefixos, sufixos ou meses impossíveis', () => {
    for (const currentMonth of ['2026-11-extra', 'xall', '2026-99', '2026-00']) {
      expect(AgentChatRequestSchema.safeParse({ message: 'Resumo', currentMonth }).success).toBe(false);
    }
    expect(AgentChatRequestSchema.safeParse({ message: 'Resumo', currentMonth: '2026-11' }).success).toBe(true);
  });
  it('valida resposta estruturada do scanner incluindo campos incertos', () => {
    const valid = ScannedReceiptResponseSchema.safeParse({
      isValidDocument: true,
      documentType: 'Cupom Fiscal',
      description: 'Supermercado Central',
      amount: 85.5,
      date: '2026-11-17',
      category: 'Alimentação',
      account: 'Pix',
      status: 'paid',
      notes: 'Compra de alimentos',
      confidence: 'media',
      uncertainFields: ['account'],
    });
    expect(valid.success).toBe(true);
  });

  it('rejeita injeção de userId ou campos não autorizados nos argumentos das ferramentas', () => {
    expect(() =>
      assertNoOwnerOverride({ userId: 'outro-usuario', amount: 10 })
    ).toThrow(/não autorizado/i);

    expect(() =>
      assertNoOwnerOverride({ user_id: 'outro-usuario' })
    ).toThrow(/não autorizado/i);

    const strictCreate = proposeCreateTransactionArgsSchema.safeParse({
      description: 'Padaria',
      amount: 25,
      type: 'expense',
      category: 'Alimentação',
      date: '2026-11-17',
      account: 'Pix',
      status: 'paid',
      userId: 'atacante',
    });
    expect(strictCreate.success).toBe(false);
  });

  it('valida parâmetros das ferramentas de consulta, atualização, exclusão, orçamento e cofrinho', () => {
    expect(
      listTransactionsArgsSchema.safeParse({
        period: '2026-11',
        type: 'expense',
        category: 'Alimentação',
        limit: 10,
      }).success
    ).toBe(true);

    expect(
      proposeUpdateTransactionArgsSchema.safeParse({
        transactionId: 'tx-123',
        status: 'paid',
      }).success
    ).toBe(true);

    expect(
      proposeDeleteTransactionArgsSchema.safeParse({
        transactionId: 'tx-123',
        reason: 'Lançamento duplicado',
      }).success
    ).toBe(true);

    expect(
      proposeUpdateBudgetArgsSchema.safeParse({
        category: 'Transporte',
        limit: 650,
        period: '2026-11',
      }).success
    ).toBe(true);

    expect(
      proposeGoalContributionArgsSchema.safeParse({
        goalId: 'goal-1',
        type: 'deposit',
        amount: 200,
      }).success
    ).toBe(true);
  });
});
