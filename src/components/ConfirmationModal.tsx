import React, { useEffect, useId } from 'react';
import { AlertTriangle, Trash2, RotateCcw, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  iconType?: 'trash' | 'reset' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = true,
  iconType = 'trash',
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => !isSubmitting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-[#FFFFFF] w-full max-w-sm rounded-3xl border border-[#EAE6DE] shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              iconType === 'reset'
                ? 'bg-[#EEF3F0] text-[#274A3C]'
                : isDestructive
                ? 'bg-[#FDF0ED] text-[#BA1A1A]'
                : 'bg-[#FCF1ED] text-[#E0835D]'
            }`}
          >
            {iconType === 'trash' ? (
              <Trash2 className="w-5 h-5" />
            ) : iconType === 'reset' ? (
              <RotateCcw className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Fechar caixa de confirmação"
            className="p-1.5 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3.5">
          <h3 id={titleId} className="text-base sm:text-lg font-bold text-[#1A1C1A]">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[#5C6661] mt-1 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-3 rounded-xl border border-[#D9D5CC] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-semibold text-[#5C6661] transition-colors cursor-pointer text-center disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              await onConfirm();
              onCancel();
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer text-center active:scale-95 disabled:opacity-60 ${
              isDestructive
                ? 'bg-[#BA1A1A] hover:bg-[#961515]'
                : 'bg-[#274A3C] hover:bg-[#1E3B30]'
            }`}
          >
            {isSubmitting ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
