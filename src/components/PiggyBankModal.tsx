import React, { useState, useEffect, useId } from 'react';
import { X, PiggyBank, Image as ImageIcon, AlertCircle, Upload } from 'lucide-react';
import { PiggyBankGoal } from '../types/finance';
import { formatCurrency } from '../utils/formatters';
import { GOAL_BEACH_URL, GOAL_RESERVE_URL, resolveAssetUrl } from '../utils/assets';
import { applyGoalContribution, parseCurrencyInput } from '../utils/financeMath';

interface PiggyBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveGoal: (goal: PiggyBankGoal) => void | Promise<void>;
  onUpdateAmount: (goalId: string, type: 'deposit' | 'withdraw', amount: number, notes?: string) => void | Promise<void>;
  initialGoal?: PiggyBankGoal | null;
  mode?: 'edit' | 'deposit' | 'withdraw';
}

export const PiggyBankModal: React.FC<PiggyBankModalProps> = ({
  isOpen,
  onClose,
  onSaveGoal,
  onUpdateAmount,
  initialGoal,
  mode = 'edit',
}) => {
  const [title, setTitle] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [deltaStr, setDeltaStr] = useState('');
  const [contributionNotes, setContributionNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setFormError(null);
    setIsSubmitting(false);
    if (initialGoal) {
      setTitle(initialGoal.title);
      setTargetAmountStr(initialGoal.targetAmount.toFixed(2).replace('.', ','));
      setCurrentAmountStr(initialGoal.currentAmount.toFixed(2).replace('.', ','));
      setTargetDate(initialGoal.targetDate || '');
      setImageUrl(initialGoal.imageUrl || '');
      setNotes(initialGoal.notes || '');
    } else {
      setTitle('');
      setTargetAmountStr('');
      setCurrentAmountStr('0');
      setTargetDate('');
      setImageUrl('');
      setNotes('');
    }
    setDeltaStr('');
    setContributionNotes('');
  }, [initialGoal, isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleLocalImageUpload = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('Formato inválido. Use imagens JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('A imagem de capa deve ter no máximo 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setFormError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (mode === 'deposit' || mode === 'withdraw') {
      if (!initialGoal) return;
      const delta = parseCurrencyInput(deltaStr);
      if (delta === null) {
        setFormError('Informe um valor válido maior que zero.');
        return;
      }

      const check = applyGoalContribution(initialGoal.currentAmount, mode, delta);
      if (!check.ok) {
        setFormError(check.error);
        return;
      }

      setIsSubmitting(true);
      try {
        await onUpdateAmount(initialGoal.id, mode, delta, contributionNotes.trim() || undefined);
        onClose();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Erro ao movimentar cofrinho.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const targetAmount = parseCurrencyInput(targetAmountStr);
    const currentAmount = parseCurrencyInput(currentAmountStr, { allowZero: true });

    if (!title.trim() || title.trim().length < 2) {
      setFormError('Informe um título válido para a meta.');
      return;
    }
    if (targetAmount === null) {
      setFormError('Informe um valor de meta válido maior que zero.');
      return;
    }
    if (currentAmount === null) {
      setFormError('O valor inicial guardado não pode ser negativo.');
      return;
    }
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setFormError('Informe uma data alvo válida.');
      return;
    }

    const goalToSave: PiggyBankGoal = {
      id: initialGoal ? initialGoal.id : `goal-${Date.now()}`,
      title: title.trim(),
      targetAmount,
      currentAmount,
      targetDate: targetDate || undefined,
      imageUrl: imageUrl.trim() || undefined,
      imagePath: initialGoal?.imagePath,
      notes: notes.trim() || undefined,
      color: initialGoal?.color || '#3F6253',
      contributions: initialGoal?.contributions || [],
    };

    setIsSubmitting(true);
    try {
      await onSaveGoal(goalToSave);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar cofrinho.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolvedPreview = resolveAssetUrl(imageUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/40 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="bg-[#FFFFFF] w-full max-w-md rounded-3xl border border-[#EAE6DE] shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F2EFE9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FAF9F6] border border-[#E6E2D8] flex items-center justify-center text-[#274A3C]">
              <PiggyBank className="w-4 h-4" />
            </div>
            <h2 id={titleId} className="text-base sm:text-lg font-bold text-[#1A1C1A]">
              {mode === 'deposit'
                ? 'Guardar Dinheiro'
                : mode === 'withdraw'
                ? 'Resgatar Dinheiro'
                : initialGoal
                ? 'Editar Cofrinho'
                : 'Novo Cofrinho'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal de cofrinho"
            className="p-1.5 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {formError && (
            <div role="alert" className="p-3 rounded-xl bg-[#FDF0ED] border border-[#F5C2B8] text-[#BA1A1A] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {mode === 'deposit' || mode === 'withdraw' ? (
            <div className="space-y-4">
              <div className="text-center py-2">
                <span className="text-xs text-[#5C6661] block mb-1">
                  {initialGoal?.title} (Saldo atual: {formatCurrency(initialGoal?.currentAmount || 0)})
                </span>
                <div className="relative inline-flex items-center justify-center">
                  <span className="text-xl sm:text-2xl font-bold text-[#5C6661] mr-1.5">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={deltaStr}
                    onChange={(e) => setDeltaStr(e.target.value)}
                    autoFocus
                    className={`text-2xl sm:text-3xl font-extrabold text-center tracking-tight bg-transparent focus:outline-none w-44 sm:w-48 font-mono tabular-nums ${
                      mode === 'deposit' ? 'text-[#437A5B]' : 'text-[#C96846]'
                    }`}
                  />
                </div>
              </div>

              {/* Quick deposit chips */}
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {[50, 100, 200, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDeltaStr(val.toString())}
                    className="px-3 py-1 bg-[#F2EFE9] hover:bg-[#EAE6DE] rounded-full text-xs font-semibold text-[#274A3C] transition-colors cursor-pointer"
                  >
                    {mode === 'deposit' ? '+' : ''} R$ {val}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="goal-contrib-notes" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  Observação do movimento (opcional)
                </label>
                <input
                  id="goal-contrib-notes"
                  type="text"
                  placeholder={mode === 'deposit' ? 'Ex: Economia do mês' : 'Ex: Compra de passagens'}
                  value={contributionNotes}
                  onChange={(e) => setContributionNotes(e.target.value)}
                  maxLength={140}
                  className="w-full px-3.5 py-2 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                />
              </div>

              <p className="text-[11px] text-[#5C6661] bg-[#FAF9F6] border border-[#EAE6DE] rounded-xl p-2.5">
                Controle pessoal: movimentações de cofrinhos são reservas internas e não duplicam despesas no seu extrato mensal.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="goal-title" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  Título da Meta
                </label>
                <input
                  id="goal-title"
                  type="text"
                  placeholder="Ex: Viagem, Notebook, Reserva..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="w-full px-3.5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-base sm:text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="goal-target" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                    Meta (R$)
                  </label>
                  <input
                    id="goal-target"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 5000,00"
                    value={targetAmountStr}
                    onChange={(e) => setTargetAmountStr(e.target.value)}
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-base sm:text-sm font-mono tabular-nums focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                  />
                </div>

                <div>
                  <label htmlFor="goal-current" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                    Guardado (R$)
                  </label>
                  <input
                    id="goal-current"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={currentAmountStr}
                    disabled={Boolean(initialGoal)}
                    onChange={(e) => setCurrentAmountStr(e.target.value)}
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-base sm:text-sm font-mono tabular-nums focus:outline-none focus:border-[#3F6253] text-[#1A1C1A] disabled:opacity-70"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="goal-date" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  Data Alvo (Opcional)
                </label>
                <input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-base sm:text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                />
              </div>

              <div className="p-3 bg-[#FAF9F6] rounded-2xl border border-[#EAE6DE] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="goal-image" className="text-xs font-bold text-[#1A1C1A] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#3F6253]" />
                    <span>Capa do Cofrinho (Opcional)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFFFFF] border border-[#D9D5CC] text-[11px] font-semibold text-[#274A3C] cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Enviar foto</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLocalImageUpload(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-[11px] text-[#BA1A1A] hover:underline cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
                <input
                  id="goal-image"
                  type="text"
                  placeholder="https://... ou envie uma imagem"
                  value={imageUrl.startsWith('data:') ? 'Imagem local selecionada' : imageUrl}
                  readOnly={imageUrl.startsWith('data:')}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-[#FFFFFF] border border-[#E6E2D8] rounded-xl focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                />
                <div className="flex gap-2 flex-wrap text-[11px]">
                  <button
                    type="button"
                    onClick={() => setImageUrl(GOAL_BEACH_URL)}
                    className="text-[#274A3C] underline cursor-pointer"
                  >
                    Foto de praia
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl(GOAL_RESERVE_URL)}
                    className="text-[#274A3C] underline cursor-pointer"
                  >
                    Foto de reserva
                  </button>
                </div>
                {resolvedPreview && (
                  <div className="h-20 w-full rounded-xl overflow-hidden border border-[#E6E2D8] bg-[#EAE6DE]">
                    <img src={resolvedPreview} alt="Prévia do cofrinho" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="goal-notes" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  Motivação / Detalhes
                </label>
                <textarea
                  id="goal-notes"
                  rows={2}
                  placeholder="Por que esse objetivo é importante..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={300}
                  className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-base sm:text-xs focus:outline-none focus:border-[#3F6253] text-[#1A1C1A] resize-none"
                />
              </div>
            </>
          )}

          <div className="pt-3 border-t border-[#F2EFE9] flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-full transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 sm:px-6 py-2.5 text-xs font-bold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-full shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting
                ? 'Salvando...'
                : mode === 'deposit'
                ? 'Confirmar Depósito'
                : mode === 'withdraw'
                ? 'Confirmar Resgate'
                : 'Salvar Cofrinho'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
