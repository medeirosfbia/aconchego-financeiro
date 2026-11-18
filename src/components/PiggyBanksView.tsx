import React, { useState } from 'react';
import {
  Plus,
  PiggyBank,
  Sparkles,
  Trash2,
  Edit2,
  ArrowDownCircle,
  ArrowUpCircle,
  Image as ImageIcon,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PiggyBankGoal } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import { resolveAssetUrl } from '../utils/assets';
import { addMoney, calculateGoalProgress } from '../utils/financeMath';
import { ConfirmationModal } from './ConfirmationModal';

interface PiggyBanksViewProps {
  goals: PiggyBankGoal[];
  onNewGoal: () => void;
  onEditGoal: (goal: PiggyBankGoal) => void;
  onDeleteGoal: (id: string) => void | Promise<void>;
  onDeposit: (goal: PiggyBankGoal) => void;
  onWithdraw: (goal: PiggyBankGoal) => void;
  onViewImage: (goal: PiggyBankGoal) => void;
}

export const PiggyBanksView: React.FC<PiggyBanksViewProps> = ({
  goals,
  onNewGoal,
  onEditGoal,
  onDeleteGoal,
  onDeposit,
  onWithdraw,
  onViewImage,
}) => {
  const [goalToDelete, setGoalToDelete] = useState<PiggyBankGoal | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const totalSaved = goals.reduce((acc, g) => addMoney(acc, g.currentAmount), 0);
  const totalTarget = goals.reduce((acc, g) => addMoney(acc, g.targetAmount), 0);

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-7 pb-10">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1A1C1A]">
            Cofrinhos & Metas dos Sonhos
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6661] mt-0.5">
            Reservas pessoais separadas para suas conquistas — movimentações aqui não contam como despesas do mês.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewGoal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-full shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Criar Cofrinho</span>
        </button>
      </div>

      {/* Summary Banner */}
      <div className="p-4 sm:p-5 md:p-6 rounded-2xl bg-[#FFFFFF] border border-[#EAE6DE] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#EEF3F0] flex items-center justify-center text-[#274A3C] shrink-0">
            <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <span className="text-[11px] sm:text-xs font-semibold text-[#5C6661] uppercase tracking-wider">
              Total Acumulado nos Cofrinhos
            </span>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[#274A3C] font-mono tabular-nums break-words">
              {formatCurrency(totalSaved)}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right text-xs text-[#5C6661]">
          <span>
            Meta global: <strong className="text-[#1A1C1A] font-mono tabular-nums">{formatCurrency(totalTarget)}</strong>
          </span>
          <div className="text-[11px] mt-0.5">
            {goals.length} {goals.length === 1 ? 'meta ativa' : 'metas ativas'}
          </div>
        </div>
      </div>

      {/* Grid of Piggy Bank cards */}
      {goals.length === 0 ? (
        <div className="bg-[#FFFFFF] p-8 sm:p-12 rounded-2xl border border-[#EAE6DE] text-center text-[#5C6661]">
          <PiggyBank className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#C1C8C3] mb-3" />
          <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A]">Nenhum cofrinho criado ainda</h3>
          <p className="text-xs sm:text-sm mt-1 max-w-md mx-auto">
            Comece guardando para sua reserva de emergência, uma viagem ou um objetivo especial.
          </p>
          <button
            type="button"
            onClick={onNewGoal}
            className="mt-4 px-4 py-2 bg-[#274A3C] text-white text-xs font-semibold rounded-full hover:bg-[#1E3B30] cursor-pointer"
          >
            + Criar meu primeiro cofrinho
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {goals.map((goal) => {
            const { progressPercent: progress, remainingAmount } = calculateGoalProgress(goal);
            const resolvedImg = resolveAssetUrl(goal.imageUrl);
            const contributions = goal.contributions || [];
            const isExpanded = expandedHistoryId === goal.id;

            return (
              <div
                key={goal.id}
                className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DE] shadow-xs overflow-hidden flex flex-col justify-between hover:border-[#3F6253]/30 transition-all group"
              >
                <div>
                  {resolvedImg ? (
                    <div
                      className="h-28 sm:h-32 md:h-36 w-full relative overflow-hidden bg-[#E6E2D8] cursor-pointer group/img"
                      onClick={() => onViewImage({ ...goal, imageUrl: resolvedImg })}
                      title="Clique para ver imagem ampliada"
                    >
                      <img
                        src={resolvedImg}
                        alt={goal.title}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <span className="absolute bottom-2 right-2 text-[10px] sm:text-[11px] font-semibold text-white bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>Ver foto</span>
                      </span>
                    </div>
                  ) : (
                    <div className="h-16 sm:h-20 w-full bg-[#FAF9F6] border-b border-[#F2EFE9] flex items-center px-4 sm:px-5 justify-between">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#EEF3F0] flex items-center justify-center text-[#274A3C]">
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <span className="text-[10px] sm:text-[11px] text-[#A0A8A3]">meta sem foto</span>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A] leading-tight truncate">
                          {goal.title}
                        </h3>
                        {goal.notes && (
                          <p className="text-[11px] sm:text-xs text-[#5C6661] mt-1 line-clamp-2">
                            {goal.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditGoal(goal)}
                          aria-label={`Editar cofrinho ${goal.title}`}
                          className="p-1.5 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-lg transition-colors cursor-pointer"
                          title="Editar cofrinho"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGoalToDelete(goal)}
                          aria-label={`Excluir cofrinho ${goal.title}`}
                          className="p-1.5 text-[#5C6661] hover:text-[#BA1A1A] hover:bg-[#FDF0ED] rounded-lg transition-colors cursor-pointer"
                          title="Excluir cofrinho"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Monetary Values */}
                    <div className="mt-3.5 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] sm:text-xs text-[#5C6661] block">Guardado</span>
                        <span className="text-lg sm:text-xl font-bold text-[#274A3C] font-mono tabular-nums">
                          {formatCurrency(goal.currentAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] sm:text-xs text-[#5C6661] block">Meta</span>
                        <span className="text-xs sm:text-sm font-semibold text-[#1A1C1A] font-mono tabular-nums">
                          {formatCurrency(goal.targetAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#5C6661] text-[11px]">
                          {remainingAmount === 0
                            ? 'Meta alcançada!'
                            : `Faltam ${formatCurrency(remainingAmount)}`}
                        </span>
                        <span className="text-[#3F6253] font-mono tabular-nums text-[11px]">{progress}%</span>
                      </div>
                      <div className="h-2 sm:h-2.5 w-full bg-[#F2EFE9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#3F6253] rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {goal.targetDate && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#5C6661]">
                        <Calendar className="w-3 h-3" />
                        <span>Previsão: {formatDate(goal.targetDate)}</span>
                      </div>
                    )}

                    {/* Movimentações */}
                    {contributions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#F5F3ED]">
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryId(isExpanded ? null : goal.id)}
                          className="w-full flex items-center justify-between text-[11px] font-semibold text-[#5C6661] hover:text-[#1A1C1A] cursor-pointer"
                        >
                          <span className="flex items-center gap-1">
                            <History className="w-3 h-3" />
                            <span>Movimentações ({contributions.length})</span>
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {contributions.slice(0, 6).map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between text-[11px] bg-[#FAF9F6] px-2 py-1 rounded-lg border border-[#F0ECE3]"
                              >
                                <div className="min-w-0 pr-2">
                                  <span className="font-medium text-[#1A1C1A] block truncate">
                                    {c.notes || (c.type === 'deposit' ? 'Depósito' : 'Resgate')}
                                  </span>
                                  <span className="text-[10px] text-[#717974]">
                                    {formatDate(c.createdAt.slice(0, 10))}
                                  </span>
                                </div>
                                <span
                                  className={`font-mono font-bold shrink-0 ${
                                    c.type === 'deposit' ? 'text-[#437A5B]' : 'text-[#C96846]'
                                  }`}
                                >
                                  {c.type === 'deposit' ? '+' : '-'}
                                  {formatCurrency(c.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="p-3 sm:p-4 bg-[#FAF9F6] border-t border-[#F2EFE9] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDeposit(goal)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-xl transition-colors cursor-pointer shadow-2xs active:scale-98"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onWithdraw(goal)}
                    disabled={goal.currentAmount <= 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-[#5C6661] bg-[#FFFFFF] hover:bg-[#F2EFE9] border border-[#D9D5CC] rounded-xl transition-colors cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    <span>Resgatar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-app Confirmation Modal for Deleting Piggy Bank */}
      <ConfirmationModal
        isOpen={Boolean(goalToDelete)}
        title="Excluir Cofrinho"
        description={
          goalToDelete
            ? `Tem certeza que deseja excluir o cofrinho "${goalToDelete.title}" com saldo de ${formatCurrency(
                goalToDelete.currentAmount
              )}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Sim, Excluir"
        cancelLabel="Cancelar"
        isDestructive={true}
        iconType="trash"
        onConfirm={async () => {
          if (goalToDelete) {
            await onDeleteGoal(goalToDelete.id);
          }
        }}
        onCancel={() => setGoalToDelete(null)}
      />
    </div>
  );
};
