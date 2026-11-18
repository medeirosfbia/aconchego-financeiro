import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Copy,
  Check,
  Image as ImageIcon,
  CreditCard,
  Link2,
} from 'lucide-react';
import { SAMPLE_RECEIPT_LINKS } from '../data/initialData';
import { Transaction } from '../types/finance';
import { formatCurrency, formatFriendlyDate } from '../utils/formatters';
import { resolveAssetUrl } from '../utils/assets';

interface ReceiptsGalleryViewProps {
  transactions: Transaction[];
  onViewReceipt: (tx: Transaction) => void;
  onNewTransactionWithImage: (imageUrl: string) => void;
}

export const ReceiptsGalleryView: React.FC<ReceiptsGalleryViewProps> = ({
  transactions,
  onViewReceipt,
  onNewTransactionWithImage,
}) => {
  const [testUrl, setTestUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  const receipts = transactions.filter((t) => Boolean(t.imageUrl));
  const resolvedTestUrl = resolveAssetUrl(testUrl);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-7 pb-10">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1A1C1A]">
            Galeria de Comprovantes & Recibos
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6661] mt-0.5">
            Arquivamento privado no Storage e visualização rápida dos comprovantes vinculados às suas movimentações.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNewTransactionWithImage(resolvedTestUrl || '')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-[#274A3C] hover:bg-[#1E3B30] rounded-full shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Novo com Foto</span>
        </button>
      </div>

      {/* Direct Image Link Helper */}
      <div className="bg-[#FFFFFF] p-4 sm:p-5 md:p-6 rounded-2xl border border-[#EAE6DE] shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#E0835D]/15 text-[#E0835D] flex items-center justify-center shrink-0 mt-0.5">
            <Link2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#1A1C1A]">
              Vincular via URL de Imagem
            </h2>
            <p className="text-[11px] sm:text-xs text-[#5C6661] mt-0.5">
              Cole um endereço de imagem (JPG, PNG, WebP) ou utilize a aba Escanear para enviar arquivos privados.
            </p>

            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Cole a URL da imagem (ex: https://...)"
                value={testUrl}
                onChange={(e) => {
                  setTestUrl(e.target.value);
                  setPreviewError(false);
                }}
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
              />
              <button
                type="button"
                onClick={() => {
                  if (resolvedTestUrl) {
                    onNewTransactionWithImage(resolvedTestUrl);
                  }
                }}
                disabled={!resolvedTestUrl}
                className="px-4 py-2 bg-[#274A3C] text-white text-xs font-semibold rounded-xl hover:bg-[#1E3B30] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap text-center"
              >
                Vincular a Despesa
              </button>
            </div>

            <div className="mt-2.5 sm:mt-3 flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
              <span className="text-[#5C6661] font-medium text-[11px]">Exemplos:</span>
              {SAMPLE_RECEIPT_LINKS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTestUrl(sample.url);
                    setPreviewError(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#F2EFE9] hover:bg-[#EAE6DE] text-[#274A3C] text-[11px] font-semibold transition-colors cursor-pointer"
                  title={sample.description}
                >
                  {sample.title}
                </button>
              ))}
            </div>

            {resolvedTestUrl && (
              <div className="mt-3 p-3 bg-[#FAF9F6] rounded-xl border border-[#EAE6DE] flex flex-col xs:flex-row items-start xs:items-center gap-3">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-[#EAE6DE] shrink-0 border border-[#D9D5CC]">
                  {!previewError ? (
                    <img
                      src={resolvedTestUrl}
                      alt="Pré-visualização do link"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setPreviewError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-[#BA1A1A] p-1 text-center">
                      <span>Erro ao carregar</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-[#5C6661] min-w-0 flex-1">
                  <span className="font-semibold text-[#1A1C1A] block text-xs">
                    Pré-visualização do Comprovante
                  </span>
                  <p className="truncate mt-0.5 font-mono text-[10px] sm:text-[11px] text-[#717974]">
                    {resolvedTestUrl}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-[#437A5B] mt-0.5">
                    ✓ Link pronto para vincular a uma despesa.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Receipts Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-bold text-[#1A1C1A]">
            Comprovantes Anexados ({receipts.length})
          </h2>
          <span className="text-[11px] sm:text-xs text-[#5C6661]">
            Toque para ampliar
          </span>
        </div>

        {receipts.length === 0 ? (
          <div className="bg-[#FFFFFF] p-8 sm:p-12 rounded-2xl border border-[#EAE6DE] text-center text-[#5C6661]">
            <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#C1C8C3] mb-3" />
            <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A]">Nenhum comprovante anexado</h3>
            <p className="text-xs sm:text-sm mt-1 max-w-md mx-auto">
              Ao escanear um recibo ou adicionar uma despesa com foto, o comprovante aparecerá aqui com acesso seguro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5">
            {receipts.map((tx) => {
              const resolvedUrl = resolveAssetUrl(tx.imageUrl);
              return (
                <div
                  key={tx.id}
                  className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DE] overflow-hidden shadow-xs hover:border-[#3F6253]/30 transition-all flex flex-col justify-between group"
                >
                  <div
                    className="h-36 sm:h-40 md:h-44 w-full bg-[#EAE6DE] relative overflow-hidden cursor-pointer group/img"
                    onClick={() => onViewReceipt({ ...tx, imageUrl: resolvedUrl })}
                    title="Clique para ampliar o comprovante"
                  >
                    <img
                      src={resolvedUrl}
                      alt={tx.description}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end p-2.5">
                      <span className="text-[11px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>Ampliar</span>
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-[#1A1C1A] truncate">
                        {tx.description}
                      </h3>

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm sm:text-base font-bold text-[#1A1C1A] font-mono tabular-nums">
                          {formatCurrency(tx.amount)}
                        </span>
                        <span className="text-[11px] text-[#5C6661]">
                          {formatFriendlyDate(tx.date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-[#5C6661] mt-1.5 truncate">
                        <CreditCard className="w-3 h-3 shrink-0" />
                        <span className="truncate">{tx.account}</span>
                        <span>·</span>
                        <span className="truncate">{tx.category}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#F2EFE9] flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleCopy(resolvedUrl)}
                        className="text-[#5C6661] hover:text-[#1A1C1A] flex items-center gap-1 cursor-pointer font-medium text-[11px]"
                        title="Copiar referência da imagem"
                      >
                        {copiedUrl === resolvedUrl ? (
                          <>
                            <Check className="w-3 h-3 text-[#437A5B]" />
                            <span className="text-[#437A5B]">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onViewReceipt({ ...tx, imageUrl: resolvedUrl })}
                        className="font-semibold text-[#274A3C] hover:underline cursor-pointer text-[11px]"
                      >
                        Ver detalhes
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
