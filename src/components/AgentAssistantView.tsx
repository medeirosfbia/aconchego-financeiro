import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wrench,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  AgentMessage,
  AgentOperationProposal,
  CategoryBudget,
  PiggyBankGoal,
  Transaction,
} from '../types/finance';
import { formatCurrency } from '../utils/formatters';

interface AgentAssistantViewProps {
  authHeaders: Record<string, string>;
  isDemoMode: boolean;
  currentMonth: string;
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: PiggyBankGoal[];
  initialConversationId?: string;
  initialMessages?: AgentMessage[];
  onDataMutated: () => Promise<void>;
  onDemoOperationExecuted?: (
    operation: AgentOperationProposal,
    mutatedData?: Record<string, unknown>
  ) => void;
}

const SUGGESTED_PROMPTS = [
  'Quanto gastei com alimentação neste mês?',
  'Registre uma compra de R$ 85,50 no supermercado, paga no Pix.',
  'Em quais categorias estou gastando mais?',
  'Estou perto de ultrapassar meu orçamento de transporte?',
  'Quanto falta para completar meu cofrinho de férias?',
];

const ARGUMENT_LABELS: Record<string, string> = {
  description: 'Descrição',
  amount: 'Valor',
  type: 'Tipo',
  category: 'Categoria',
  date: 'Data',
  account: 'Forma de pagamento',
  status: 'Situação',
  notes: 'Observações',
  limit: 'Novo limite',
  period: 'Período',
  goalId: 'ID do cofrinho',
  goalTitle: 'Cofrinho',
  transactionId: 'ID da transação',
  reason: 'Motivo',
};

function formatArgValue(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if ((key === 'amount' || key === 'limit') && typeof value === 'number') {
    return formatCurrency(value);
  }
  if (key === 'type') {
    if (value === 'expense') return 'Despesa';
    if (value === 'income') return 'Receita';
    if (value === 'deposit') return 'Depósito';
    if (value === 'withdraw') return 'Resgate';
  }
  if (key === 'status') {
    return value === 'paid' ? 'Efetivado / Pago' : 'Pendente';
  }
  return String(value);
}

export const AgentAssistantView: React.FC<AgentAssistantViewProps> = ({
  authHeaders,
  isDemoMode,
  currentMonth,
  transactions,
  budgets,
  goals,
  initialConversationId,
  initialMessages = [],
  onDataMutated,
  onDemoOperationExecuted,
}) => {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingOpId, setProcessingOpId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
      setConversationId(initialConversationId);
    }
  }, [initialMessages, initialConversationId, messages.length]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    setInput('');

    const optimisticUserMsg: AgentMessage = {
      id: `local-user-${Date.now()}`,
      conversationId: conversationId || 'pending',
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsSending(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          conversationId,
          message: trimmed,
          currentMonth,
          ...(isDemoMode
            ? {
                demoState: {
                  transactions,
                  budgets,
                  goals,
                },
              }
            : {}),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao conversar com o Assistente Financeiro.');
      }

      if (payload.conversationId) {
        setConversationId(payload.conversationId);
      }

      const proposals = Array.isArray(payload.operationProposals)
        ? (payload.operationProposals as AgentOperationProposal[])
        : [];

      const assistantMsg: AgentMessage = {
        id: `assistant-${Date.now()}`,
        conversationId: payload.conversationId || conversationId || 'active',
        role: 'assistant',
        content: payload.reply,
        toolTraces: payload.toolTraces || [],
        operationProposal: proposals[0],
        disclaimer: payload.disclaimer,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha de comunicação com o Assistente IA.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmOrCancel = async (
    op: AgentOperationProposal,
    action: 'confirm' | 'cancel'
  ) => {
    if (processingOpId) return;
    setProcessingOpId(op.id);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/agent/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          operationId: op.id,
          action,
          idempotencyKey: op.idempotencyKey,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.operation) {
          setMessages((prev) =>
            prev.map((m) =>
              m.operationProposal?.id === op.id
                ? { ...m, operationProposal: payload.operation }
                : m
            )
          );
        }
        throw new Error(payload.error || 'Não foi possível processar esta confirmação.');
      }

      const updatedOp = payload.operation as AgentOperationProposal;
      setMessages((prev) =>
        prev.map((m) =>
          m.operationProposal?.id === op.id ? { ...m, operationProposal: updatedOp } : m
        )
      );

      if (action === 'confirm') {
        if (isDemoMode && onDemoOperationExecuted) {
          onDemoOperationExecuted(updatedOp, payload.mutatedData);
        } else {
          await onDataMutated();
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao confirmar operação.');
    } finally {
      setProcessingOpId(null);
    }
  };

  const handleNewConversation = () => {
    setConversationId(undefined);
    setMessages([]);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1A1C1A] flex items-center gap-2.5">
            <span>Assistente Financeiro IA</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6661] mt-0.5">
            Consulte seus dados reais, analise gastos por categoria e registre movimentações por linguagem natural com confirmação humana.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FFFFFF] border border-[#D9D5CC] hover:bg-[#F2EFE9] text-xs font-semibold text-[#1A1C1A] cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Nova Conversa</span>
          </button>
        )}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Chat Column */}
        <div className="lg:col-span-8 bg-[#FFFFFF] rounded-2xl border border-[#EAE6DE] shadow-xs flex flex-col min-h-[520px] max-h-[75vh] overflow-hidden">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="py-8 sm:py-12 text-center space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF3F0] text-[#274A3C] flex items-center justify-center mx-auto">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A1C1A]">
                    Como posso ajudar com suas finanças hoje?
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5C6661] mt-1">
                    Eu consulto apenas os seus lançamentos, orçamentos e cofrinhos reais — e sempre peço sua confirmação antes de alterar qualquer dado.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs px-3.5 py-2 rounded-2xl bg-[#FAF9F6] hover:bg-[#EEF3F0] border border-[#E6E2D8] hover:border-[#3F6253]/40 text-[#274A3C] font-medium transition-colors cursor-pointer"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-4 space-y-3 ${
                      msg.role === 'user'
                        ? 'bg-[#274A3C] text-white'
                        : 'bg-[#FAF9F6] border border-[#EAE6DE] text-[#1A1C1A]'
                    }`}
                  >
                    {msg.role === 'assistant' && msg.toolTraces && msg.toolTraces.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-[#EAE6DE]">
                        <Wrench className="w-3 h-3 text-[#3F6253]" />
                        {msg.toolTraces.map((trace, idx) => (
                          <span
                            key={`${trace.name}-${idx}`}
                            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#E3ECE7] text-[#274A3C]"
                          >
                            {trace.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* Confirmation Card for Proposed Operations */}
                    {msg.operationProposal && (
                      <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#D4E2DA] space-y-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#274A3C]">
                              Operação Proposta
                            </span>
                            <h3 className="text-sm font-bold text-[#1A1C1A]">
                              {msg.operationProposal.title}
                            </h3>
                            <p className="text-[11px] text-[#5C6661] mt-0.5">
                              {msg.operationProposal.summary}
                            </p>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              msg.operationProposal.status === 'executed'
                                ? 'bg-[#EDF5F0] text-[#437A5B]'
                                : msg.operationProposal.status === 'cancelled'
                                ? 'bg-[#F2EFE9] text-[#5C6661]'
                                : 'bg-[#FCF1ED] text-[#954827]'
                            }`}
                          >
                            {msg.operationProposal.status === 'executed'
                              ? 'Confirmada'
                              : msg.operationProposal.status === 'cancelled'
                              ? 'Cancelada'
                              : 'Aguardando confirmação'}
                          </span>
                        </div>

                        {/* Exact Arguments Preview */}
                        <div className="bg-[#FAF9F6] rounded-lg p-2.5 border border-[#F0ECE3] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                          {Object.entries(msg.operationProposal.arguments).map(([k, v]) => (
                            <div key={k} className="truncate">
                              <span className="text-[#5C6661]">
                                {ARGUMENT_LABELS[k] || k}:{' '}
                              </span>
                              <strong className="text-[#1A1C1A]">
                                {formatArgValue(k, v)}
                              </strong>
                            </div>
                          ))}
                        </div>

                        {msg.operationProposal.status === 'pending_confirmation' && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={processingOpId === msg.operationProposal.id}
                              onClick={() =>
                                handleConfirmOrCancel(msg.operationProposal!, 'confirm')
                              }
                              className="px-4 py-2 rounded-full bg-[#274A3C] hover:bg-[#1E3B30] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {processingOpId === msg.operationProposal.id
                                  ? 'Executando...'
                                  : 'Confirmar e Executar'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={processingOpId === msg.operationProposal.id}
                              onClick={() =>
                                handleConfirmOrCancel(msg.operationProposal!, 'cancel')
                              }
                              className="px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#D9D5CC] hover:bg-[#F2EFE9] text-[#5C6661] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Cancelar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {msg.disclaimer && (
                      <p className="text-[10px] text-[#5C6661] pt-1 border-t border-[#EAE6DE]">
                        {msg.disclaimer}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl p-3.5 bg-[#FAF9F6] border border-[#EAE6DE] text-xs text-[#5C6661] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#274A3C] animate-pulse" />
                  <span>Consultando seus dados reais com o Gemini...</span>
                </div>
              </div>
            )}

            <div ref={listEndRef} />
          </div>

          {errorMsg && (
            <div role="alert" className="mx-4 mb-2 p-3 rounded-xl bg-[#FDF0ED] border border-[#F5C2B8] text-xs font-semibold text-[#BA1A1A] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-3 sm:p-4 border-t border-[#EAE6DE] bg-[#FAF9F6] flex items-center gap-2"
          >
            <input
              type="text"
              aria-label="Mensagem para o Assistente Financeiro"
              placeholder="Pergunte sobre gastos, metas ou peça para registrar uma despesa..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending}
              maxLength={1500}
              className="flex-1 px-4 py-2.5 bg-[#FFFFFF] border border-[#E6E2D8] rounded-full text-xs sm:text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              aria-label="Enviar mensagem"
              className="px-4 sm:px-5 py-2.5 rounded-full bg-[#274A3C] hover:bg-[#1E3B30] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>

        {/* Side Guardrails & Quick Suggestions */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DE] shadow-xs p-5 space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-[#1A1C1A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#437A5B]" />
              <span>Transparência e Segurança</span>
            </h2>
            <ul className="space-y-2 text-xs text-[#5C6661]">
              <li>• Consulta apenas os registros da sua conta autenticada.</li>
              <li>• Cálculos financeiros rodam em código determinístico no servidor.</li>
              <li>• Toda criação, edição ou exclusão exige sua confirmação explícita.</li>
              <li>• Nenhuma alteração é executada em duplicidade.</li>
            </ul>
          </div>

          <div className="bg-[#F4F3F0] rounded-2xl border border-[#E9E5DC] p-4 sm:p-5 space-y-2.5">
            <p className="text-xs font-bold text-[#1A1C1A]">Exemplos rápidos</p>
            <div className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isSending}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-[11px] px-3 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[#EEF3F0] border border-[#E6E2D8] text-[#274A3C] font-medium transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
