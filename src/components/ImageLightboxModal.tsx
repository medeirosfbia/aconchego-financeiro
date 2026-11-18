import React, { useState, useEffect, useId } from 'react';
import { X, ExternalLink, Copy, Check } from 'lucide-react';
import { Transaction } from '../types/finance';
import { formatCurrency, formatFriendlyDate } from '../utils/formatters';
import { resolveAssetUrl } from '../utils/assets';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title?: string;
  transaction?: Transaction | null;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  transaction,
}) => {
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const resolvedUrl = resolveAssetUrl(imageUrl);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !resolvedUrl) return null;

  const displayTitle = transaction ? transaction.description : title || 'Comprovante / Recibo';

  const handleCopy = () => {
    navigator.clipboard.writeText(resolvedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="relative bg-[#FFFFFF] w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-[#FAF9F6]/20 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 bg-[#FAF9F6] border-b border-[#EAE6DE] flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-sm sm:text-base font-bold text-[#1A1C1A] truncate">
              {displayTitle}
            </h3>
            {transaction && (
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#5C6661] mt-0.5 truncate">
                <span className="font-semibold text-[#1A1C1A] font-mono tabular-nums">
                  {formatCurrency(transaction.amount)}
                </span>
                <span>·</span>
                <span>{formatFriendlyDate(transaction.date)}</span>
                <span className="hidden xs:inline">·</span>
                <span className="hidden xs:inline">{transaction.account}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copiar link direto da imagem"
              className="p-1.5 sm:p-2 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#EAE6DE] rounded-xl transition-colors cursor-pointer text-xs font-medium flex items-center gap-1"
              title="Copiar link direto da imagem"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#437A5B]" />
                  <span className="text-[#437A5B] hidden sm:inline">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Copiar</span>
                </>
              )}
            </button>

            <a
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Abrir imagem em nova aba"
              className="p-1.5 sm:p-2 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#EAE6DE] rounded-xl transition-colors cursor-pointer text-xs font-medium flex items-center gap-1"
              title="Abrir imagem em tamanho original"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Abrir</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualização"
              className="p-1.5 sm:p-2 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#EAE6DE] rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Preview Container */}
        <div className="p-4 sm:p-6 bg-[#1A1C1A] flex items-center justify-center overflow-auto flex-1 max-h-[65vh]">
          <img
            src={resolvedUrl}
            alt={displayTitle}
            className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Footer with Direct Link Info */}
        <div className="px-5 py-3 bg-[#FAF9F6] border-t border-[#EAE6DE] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#5C6661]">
          <div className="truncate flex-1 font-mono text-[11px] text-[#717974]">
            Referência: <span className="text-[#1A1C1A]">{resolvedUrl.startsWith('data:') ? 'Imagem capturada localmente' : resolvedUrl}</span>
          </div>
          {transaction?.notes && (
            <div className="text-right italic truncate max-w-xs">
              "{transaction.notes}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
