import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  RefreshCw,
  ArrowRight,
  FileText,
  Zap,
  Droplets,
  Receipt,
  X,
  ShieldAlert,
} from 'lucide-react';
import {
  PaymentMethod,
  ScannedReceiptResult,
  Transaction,
  TransactionStatus,
  UncertainReceiptField,
} from '../types/finance';
import { DEFAULT_CATEGORIES, PAYMENT_METHODS } from '../data/initialData';
import { formatCurrency, formatFriendlyDate } from '../utils/formatters';
import { RECEIPT_SAMPLE_URL, resolveAssetUrl } from '../utils/assets';
import { parseCurrencyInput } from '../utils/financeMath';
import { computeFileSha256Hex } from '../services/financeRepository';
import { CategoryIcon } from './CategoryIcon';

export interface ConfirmScannedExpenseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
  account: PaymentMethod;
  status: TransactionStatus;
  notes?: string;
  imageUrl: string;
  fileHash?: string;
  documentType: string;
  extractedPayload?: Record<string, unknown>;
}

interface ScanReceiptViewProps {
  authHeaders: Record<string, string>;
  demoImportedHashes?: string[];
  onConfirmExpense: (data: ConfirmScannedExpenseInput) => Promise<Transaction>;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void | Promise<void>;
  onGoToTransactions: () => void;
  onViewReceipt: (tx: Transaction) => void;
}

interface CompressedImage {
  dataUrl: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

interface ReviewDraft {
  documentType: string;
  confidence: 'alta' | 'media' | 'baixa';
  uncertainFields: UncertainReceiptField[];
  fileHash?: string;
  description: string;
  amountStr: string;
  date: string;
  category: string;
  account: PaymentMethod;
  status: TransactionStatus;
  notes: string;
}

async function compressBlobToJpeg(blob: Blob): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX_DIM = 1400;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Não foi possível preparar a imagem.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        URL.revokeObjectURL(objectUrl);
        resolve({ dataUrl, mimeType: 'image/jpeg' });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar o arquivo de imagem selecionado.'));
    };
    img.src = objectUrl;
  });
}

export const ScanReceiptView: React.FC<ScanReceiptViewProps> = ({
  authHeaders,
  demoImportedHashes,
  onConfirmExpense,
  onEditTransaction,
  onDeleteTransaction,
  onGoToTransactions,
  onViewReceipt,
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<ReviewDraft | null>(null);
  const [lastRegistered, setLastRegistered] = useState<{
    transaction: Transaction;
    documentType: string;
    confidence: 'alta' | 'media' | 'baixa';
  } | null>(null);
  const [sessionScanned, setSessionScanned] = useState<Transaction[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async (requestedFacing: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setScanError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Câmera ao vivo não disponível neste navegador. Use o botão "Escolher Imagem" abaixo.'
      );
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: requestedFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setIsCameraOpen(false);
      setCameraError(
        'Não foi possível abrir a câmera ao vivo (permissão negada ou dispositivo sem câmera). Use "Escolher Imagem".'
      );
    }
  };

  const toggleFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const analyzeImageForReview = async (
    dataUrl: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  ) => {
    setPreviewUrl(dataUrl);
    setIsScanning(true);
    setScanError(null);
    setReviewError(null);
    setPendingReview(null);
    setLastRegistered(null);

    try {
      const localHash = await computeFileSha256Hex(dataUrl);
      if (demoImportedHashes && demoImportedHashes.includes(localHash)) {
        throw new Error(
          'Este comprovante já foi importado anteriormente. Para evitar lançamentos duplicados, o envio foi bloqueado.'
        );
      }

      const today = new Date().toISOString().split('T')[0];
      const response = await fetch('/api/receipts/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
          todayDate: today,
          ...(demoImportedHashes ? { demoState: { importedHashes: demoImportedHashes } } : {}),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || 'Não foi possível ler os dados deste documento.'
        );
      }

      const parsed = payload as ScannedReceiptResult;

      // Nunca salva automaticamente: cria prévia editável para revisão humana
      setPendingReview({
        documentType: parsed.documentType,
        confidence: parsed.confidence,
        uncertainFields: parsed.uncertainFields || [],
        fileHash: parsed.fileHash || localHash,
        description: parsed.description,
        amountStr: parsed.amount.toFixed(2).replace('.', ','),
        date: parsed.date,
        category: parsed.category,
        account: parsed.account,
        status: parsed.status,
        notes: parsed.notes || '',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro inesperado ao processar o recibo.';
      setScanError(message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingReview || !previewUrl || isConfirming) return;
    setReviewError(null);

    const parsedAmount = parseCurrencyInput(pendingReview.amountStr);
    if (parsedAmount === null) {
      setReviewError('Informe um valor válido maior que zero antes de confirmar.');
      return;
    }

    if (!pendingReview.description.trim()) {
      setReviewError('Informe a descrição do estabelecimento ou conta.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(pendingReview.date)) {
      setReviewError('Informe uma data válida no formato AAAA-MM-DD.');
      return;
    }

    setIsConfirming(true);
    try {
      const createdTx = await onConfirmExpense({
        description: pendingReview.description.trim(),
        amount: parsedAmount,
        category: pendingReview.category,
        date: pendingReview.date,
        account: pendingReview.account,
        status: pendingReview.status,
        imageUrl: previewUrl,
        fileHash: pendingReview.fileHash,
        documentType: pendingReview.documentType,
        notes: pendingReview.notes.trim()
          ? `${pendingReview.documentType} · ${pendingReview.notes.trim()}`
          : pendingReview.documentType,
        extractedPayload: {
          documentType: pendingReview.documentType,
          confidence: pendingReview.confidence,
          uncertainFields: pendingReview.uncertainFields,
        },
      });

      setLastRegistered({
        transaction: createdTx,
        documentType: pendingReview.documentType,
        confidence: pendingReview.confidence,
      });
      setSessionScanned((prev) => [createdTx, ...prev]);
      setPendingReview(null);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : 'Erro ao salvar lançamento confirmado.'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCaptureFromVideo = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    await analyzeImageForReview(dataUrl, 'image/jpeg');
  };

  const handleFileSelected = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setScanError('Formato não suportado. Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setScanError('O arquivo selecionado ultrapassa o limite seguro de tamanho (10 MB).');
      return;
    }

    try {
      stopCamera();
      const { dataUrl, mimeType } = await compressBlobToJpeg(file);
      await analyzeImageForReview(dataUrl, mimeType);
    } catch (err: unknown) {
      setScanError(
        err instanceof Error ? err.message : 'Erro ao preparar a imagem.'
      );
    }
  };

  const handleTestSampleReceipt = async () => {
    try {
      stopCamera();
      setScanError(null);
      const res = await fetch(RECEIPT_SAMPLE_URL);
      if (!res.ok) throw new Error('Não foi possível carregar a imagem de exemplo.');
      const blob = await res.blob();
      const { dataUrl, mimeType } = await compressBlobToJpeg(blob);
      await analyzeImageForReview(dataUrl, mimeType);
    } catch (err: unknown) {
      setScanError(
        err instanceof Error ? err.message : 'Erro ao testar recibo de exemplo.'
      );
    }
  };

  const handleUndoLast = async () => {
    if (!lastRegistered) return;
    const targetId = lastRegistered.transaction.id;
    await onDeleteTransaction(targetId);
    setSessionScanned((prev) => prev.filter((t) => t.id !== targetId));
    setLastRegistered(null);
    setPreviewUrl(null);
  };

  const handleResetScanner = () => {
    setPreviewUrl(null);
    setScanError(null);
    setReviewError(null);
    setPendingReview(null);
    setLastRegistered(null);
    setCameraError(null);
  };

  const isFieldUncertain = (field: UncertainReceiptField) =>
    pendingReview?.uncertainFields.includes(field) ?? false;

  return (
    <div className="space-y-6 pb-10">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#1A1C1A]">
            Escanear Recibo ou Conta
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6661] mt-1">
            Envie seu cupom fiscal, nota fiscal, conta de luz ou água. A IA extrai os dados para sua revisão e confirmação antes de salvar.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left: Capture & Review Workspace */}
        <div className="lg:col-span-7 bg-[#FFFFFF] rounded-2xl border border-[#EAE6DE] shadow-xs p-4 sm:p-6 space-y-5">
          {isCameraOpen ? (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-[#1A1C1A] aspect-[3/4] sm:aspect-[4/3] max-h-[60vh] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-white/50 rounded-xl flex items-end justify-center p-3">
                  <span className="text-[11px] font-medium text-white bg-black/55 px-3 py-1 rounded-full backdrop-blur-xs">
                    Enquadre o recibo ou conta com boa iluminação
                  </span>
                </div>

                <button
                  type="button"
                  onClick={stopCamera}
                  aria-label="Fechar câmera"
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="px-4 py-2.5 rounded-full bg-[#F2EFE9] hover:bg-[#EAE6DE] text-xs font-semibold text-[#1A1C1A] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Alternar Câmera</span>
                </button>

                <button
                  type="button"
                  onClick={handleCaptureFromVideo}
                  className="px-6 py-3 rounded-full bg-[#274A3C] hover:bg-[#1E3B30] text-sm font-bold text-white flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturar para Revisão</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelected(file);
                  e.target.value = '';
                }}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelected(file);
                  e.target.value = '';
                }}
              />

              {previewUrl ? (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-[#F4F3F0] border border-[#EAE6DE] max-h-72 flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Foto do documento capturado"
                      className={`max-h-72 w-full object-contain transition-opacity duration-300 ${
                        isScanning ? 'opacity-50' : 'opacity-100'
                      }`}
                    />
                    {isScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF9F6]/80 backdrop-blur-[2px] p-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#274A3C] text-[#C4EBD8] flex items-center justify-center mb-3 animate-pulse">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <p className="text-sm sm:text-base font-bold text-[#1A1C1A]">
                          Analisando documento com Gemini...
                        </p>
                        <p className="text-xs text-[#5C6661] mt-1 max-w-xs">
                          Extraindo estabelecimento, valor, data e categoria para você revisar.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Error State */}
                  {scanError && !isScanning && (
                    <div role="alert" className="p-4 rounded-2xl bg-[#FDF0ED] border border-[#F5C2B8] space-y-3">
                      <div className="flex items-start gap-2.5 text-[#BA1A1A]">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm">
                          <p className="font-bold">Não foi possível interpretar este documento</p>
                          <p className="mt-0.5 text-[#7A2018]">{scanError}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleResetScanner}
                          className="px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#D9D5CC] text-xs font-semibold text-[#1A1C1A] hover:bg-[#FAF9F6] cursor-pointer"
                        >
                          Tentar outra imagem
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Editable Human-Review Form (Mandatory before saving!) */}
                  {pendingReview && !isScanning && (
                    <form
                      onSubmit={handleConfirmReview}
                      className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F6] border border-[#D8E2DC] space-y-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#274A3C] bg-[#E3ECE7] px-2.5 py-0.5 rounded-full">
                            Prévia para Confirmação
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A] mt-1.5">
                            Revise os dados lidos antes de registrar
                          </h3>
                          <p className="text-[11px] text-[#5C6661]">
                            {pendingReview.documentType} · Confiança {pendingReview.confidence} · A leitura por IA não confirma pagamento automaticamente.
                          </p>
                        </div>
                      </div>

                      {pendingReview.uncertainFields.length > 0 && (
                        <div className="p-3 rounded-xl bg-[#FCF1ED] border border-[#F5D3C4] text-xs text-[#954827] flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            Campos marcados como <strong>Pendente de revisão</strong> não estavam nítidos no documento. Confira antes de confirmar.
                          </span>
                        </div>
                      )}

                      {reviewError && (
                        <div role="alert" className="p-3 rounded-xl bg-[#FDF0ED] border border-[#F5C2B8] text-xs font-semibold text-[#BA1A1A] flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{reviewError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="sm:col-span-2">
                          <label htmlFor="scan-desc" className="flex items-center justify-between font-bold text-[#1A1C1A] mb-1">
                            <span>Descrição / Estabelecimento</span>
                            {isFieldUncertain('description') && (
                              <span className="text-[10px] font-semibold text-[#954827] bg-[#FCF1ED] px-1.5 py-0.5 rounded">
                                Pendente de revisão
                              </span>
                            )}
                          </label>
                          <input
                            id="scan-desc"
                            type="text"
                            value={pendingReview.description}
                            onChange={(e) =>
                              setPendingReview({ ...pendingReview, description: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D9D5CC] rounded-xl text-sm focus:outline-none focus:border-[#3F6253]"
                          />
                        </div>

                        <div>
                          <label htmlFor="scan-amount" className="flex items-center justify-between font-bold text-[#1A1C1A] mb-1">
                            <span>Valor Total (R$)</span>
                            {isFieldUncertain('amount') && (
                              <span className="text-[10px] font-semibold text-[#954827] bg-[#FCF1ED] px-1.5 py-0.5 rounded">
                                Pendente de revisão
                              </span>
                            )}
                          </label>
                          <input
                            id="scan-amount"
                            type="text"
                            inputMode="decimal"
                            value={pendingReview.amountStr}
                            onChange={(e) =>
                              setPendingReview({ ...pendingReview, amountStr: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D9D5CC] rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-[#3F6253]"
                          />
                        </div>

                        <div>
                          <label htmlFor="scan-date" className="flex items-center justify-between font-bold text-[#1A1C1A] mb-1">
                            <span>Data / Vencimento</span>
                            {isFieldUncertain('date') && (
                              <span className="text-[10px] font-semibold text-[#954827] bg-[#FCF1ED] px-1.5 py-0.5 rounded">
                                Pendente de revisão
                              </span>
                            )}
                          </label>
                          <input
                            id="scan-date"
                            type="date"
                            value={pendingReview.date}
                            onChange={(e) =>
                              setPendingReview({ ...pendingReview, date: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D9D5CC] rounded-xl text-sm focus:outline-none focus:border-[#3F6253]"
                          />
                        </div>

                        <div>
                          <label htmlFor="scan-category" className="flex items-center justify-between font-bold text-[#1A1C1A] mb-1">
                            <span>Categoria</span>
                            {isFieldUncertain('category') && (
                              <span className="text-[10px] font-semibold text-[#954827] bg-[#FCF1ED] px-1.5 py-0.5 rounded">
                                Pendente de revisão
                              </span>
                            )}
                          </label>
                          <select
                            id="scan-category"
                            value={pendingReview.category}
                            onChange={(e) =>
                              setPendingReview({ ...pendingReview, category: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D9D5CC] rounded-xl text-sm focus:outline-none focus:border-[#3F6253]"
                          >
                            {DEFAULT_CATEGORIES.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="scan-account" className="flex items-center justify-between font-bold text-[#1A1C1A] mb-1">
                            <span>Forma de Pagamento</span>
                            {isFieldUncertain('account') && (
                              <span className="text-[10px] font-semibold text-[#954827] bg-[#FCF1ED] px-1.5 py-0.5 rounded">
                                Pendente de revisão
                              </span>
                            )}
                          </label>
                          <select
                            id="scan-account"
                            value={pendingReview.account}
                            onChange={(e) =>
                              setPendingReview({
                                ...pendingReview,
                                account: e.target.value as PaymentMethod,
                              })
                            }
                            className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D9D5CC] rounded-xl text-sm focus:outline-none focus:border-[#3F6253]"
                          >
                            {PAYMENT_METHODS.map((pm) => (
                              <option key={pm} value={pm}>
                                {pm}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between font-bold text-[#1A1C1A] mb-1">
                            <span>Situação do Pagamento</span>
                            {isFieldUncertain('status') && (
                              <span className="text-[10px] font-semibold text-[#954827] bg-[#FCF1ED] px-1.5 py-0.5 rounded">
                                Pendente de revisão
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPendingReview({ ...pendingReview, status: 'paid' })
                              }
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                                pendingReview.status === 'paid'
                                  ? 'bg-[#EEF3F0] text-[#274A3C] border-[#3F6253]'
                                  : 'bg-[#FFFFFF] text-[#5C6661] border-[#E6E2D8]'
                              }`}
                            >
                              ✓ Já foi pago (Efetivado)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingReview({ ...pendingReview, status: 'pending' })
                              }
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                                pendingReview.status === 'pending'
                                  ? 'bg-[#FCF1ED] text-[#C96846] border-[#E0835D]'
                                  : 'bg-[#FFFFFF] text-[#5C6661] border-[#E6E2D8]'
                              }`}
                            >
                              ⏳ A pagar (Pendente)
                            </button>
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="scan-notes" className="block font-bold text-[#1A1C1A] mb-1">
                            Detalhes extraídos / Observações
                          </label>
                          <textarea
                            id="scan-notes"
                            rows={2}
                            value={pendingReview.notes}
                            onChange={(e) =>
                              setPendingReview({ ...pendingReview, notes: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D9D5CC] rounded-xl text-xs focus:outline-none focus:border-[#3F6253] resize-none"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleResetScanner}
                          disabled={isConfirming}
                          className="px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#D9D5CC] text-xs font-semibold text-[#5C6661] hover:text-[#1A1C1A] cursor-pointer"
                        >
                          Descartar
                        </button>
                        <button
                          type="submit"
                          disabled={isConfirming}
                          className="px-5 py-2.5 rounded-full bg-[#274A3C] hover:bg-[#1E3B30] text-xs font-bold text-white shadow-sm cursor-pointer disabled:opacity-60"
                        >
                          {isConfirming ? 'Salvando...' : 'Confirmar e Salvar Despesa'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Confirmed & Saved Card */}
                  {lastRegistered && !isScanning && !pendingReview && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#EDF5F0] border border-[#B9DCC7] space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#274A3C] text-white flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-bold text-[#1A1C1A]">
                              Despesa confirmada e salva
                            </h3>
                            <p className="text-xs text-[#2B4D3F]">
                              {lastRegistered.documentType} · Comprovante arquivado com segurança
                            </p>
                          </div>
                        </div>

                        <span className="text-lg sm:text-xl font-extrabold text-[#274A3C] font-mono tabular-nums shrink-0">
                          -{formatCurrency(lastRegistered.transaction.amount)}
                        </span>
                      </div>

                      <div className="bg-[#FFFFFF] p-3.5 rounded-xl border border-[#DCE8E0] grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <span className="text-[#5C6661] block">Descrição</span>
                          <span className="font-bold text-[#1A1C1A]">
                            {lastRegistered.transaction.description}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5C6661] block">Categoria</span>
                          <span className="font-semibold text-[#1A1C1A]">
                            {lastRegistered.transaction.category}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5C6661] block">Data / Vencimento</span>
                          <span className="font-semibold text-[#1A1C1A]">
                            {formatFriendlyDate(lastRegistered.transaction.date)} ({lastRegistered.transaction.date})
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5C6661] block">Pagamento e Situação</span>
                          <span className="font-semibold text-[#1A1C1A]">
                            {lastRegistered.transaction.account} ·{' '}
                            {lastRegistered.transaction.status === 'paid' ? 'Efetivado' : 'Pendente'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleResetScanner}
                          className="px-4 py-2 rounded-full bg-[#274A3C] hover:bg-[#1E3B30] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Escanear outro</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditTransaction(lastRegistered.transaction)}
                          className="px-3.5 py-2 rounded-full bg-[#FFFFFF] border border-[#D9D5CC] hover:bg-[#FAF9F6] text-xs font-semibold text-[#1A1C1A] flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar detalhes</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleUndoLast}
                          className="px-3.5 py-2 rounded-full bg-[#FFFFFF] border border-[#F5C2B8] hover:bg-[#FDF0ED] text-xs font-semibold text-[#BA1A1A] flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Desfazer</span>
                        </button>

                        <button
                          type="button"
                          onClick={onGoToTransactions}
                          className="ml-auto text-xs font-semibold text-[#274A3C] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ver no Extrato</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                  className={`rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-colors ${
                    isDragging
                      ? 'border-[#274A3C] bg-[#EEF3F0]/60'
                      : 'border-[#D9D5CC] bg-[#FAF9F6]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#EEF3F0] text-[#274A3C] flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A1C1A]">
                    Fotografe ou envie seu documento
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5C6661] mt-1 max-w-md mx-auto">
                    Aceita imagens JPG, PNG e WebP (até 8 MB). Após a análise da IA, você revisa os campos e confirma antes de gravar.
                  </p>

                  {cameraError && (
                    <div className="mt-4 p-3 rounded-xl bg-[#FCF1ED] border border-[#F5D3C4] text-xs text-[#954827] text-left max-w-md mx-auto">
                      {cameraError}
                    </div>
                  )}

                  {scanError && (
                    <div className="mt-4 p-3 rounded-xl bg-[#FDF0ED] border border-[#F5C2B8] text-xs text-[#BA1A1A] text-left max-w-md mx-auto">
                      {scanError}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => startCamera('environment')}
                      className="w-full sm:w-auto px-5 py-3 rounded-full bg-[#274A3C] hover:bg-[#1E3B30] text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Abrir Câmera ao Vivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full sm:w-auto px-5 py-3 rounded-full bg-[#E0835D] hover:bg-[#CC714C] text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer sm:hidden"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Câmera do Celular</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="w-full sm:w-auto px-5 py-3 rounded-full bg-[#FFFFFF] hover:bg-[#F2EFE9] border border-[#D9D5CC] text-xs sm:text-sm font-semibold text-[#1A1C1A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-[#5C6661]" />
                      <span>Escolher Imagem</span>
                    </button>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#EAE6DE] flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleTestSampleReceipt}
                      className="text-xs font-semibold text-[#3F6253] hover:text-[#274A3C] underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Testar leitura com cupom de supermercado de exemplo</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: What the AI reads + Tips */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#FFFFFF] rounded-2xl border border-[#EAE6DE] shadow-xs p-5 space-y-4">
            <h2 className="text-base font-bold text-[#1A1C1A]">
              Como funciona a leitura segura
            </h2>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FDF2EB] text-[#E0835D] flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1C1A]">Recibos e Cupons Fiscais</p>
                  <p className="text-xs text-[#5C6661]">
                    Extrai estabelecimento, total e forma de pagamento para prévia editável.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FCF1ED] text-[#C96846] flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1C1A]">Contas de Luz (Energia)</p>
                  <p className="text-xs text-[#5C6661]">
                    Identifica vencimento e concessionária; boletos em aberto ficam como Pendente.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#EEF4F8] text-[#4B739B] flex items-center justify-center shrink-0">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1C1A]">Contas de Água e Serviços</p>
                  <p className="text-xs text-[#5C6661]">
                    Faturas de água, gás, internet e boletos com proteção contra duplicidade.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#EEF3F0] text-[#3F6253] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1C1A]">Armazenamento Privado</p>
                  <p className="text-xs text-[#5C6661]">
                    Após sua confirmação, a imagem é salva no seu bucket privado no Supabase Storage.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#F4F3F0] rounded-2xl border border-[#E9E5DC] p-4 sm:p-5 text-xs text-[#5C6661] space-y-1.5">
            <p className="font-bold text-[#1A1C1A]">Fluxo de validação humana</p>
            <p>1. Envie ou fotografe o comprovante em local bem iluminado.</p>
            <p>2. Confira os campos extraídos (especialmente os marcados como pendentes de revisão).</p>
            <p>3. Clique em "Confirmar e Salvar Despesa" para gravar no extrato.</p>
          </div>
        </div>
      </div>

      {/* Session History */}
      {sessionScanned.length > 0 && (
        <div className="bg-[#FFFFFF] p-4 sm:p-6 rounded-2xl border border-[#EAE6DE] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1A1C1A]">
                Confirmados nesta sessão ({sessionScanned.length})
              </h2>
              <p className="text-xs text-[#5C6661]">
                Lançamentos salvos com comprovante vinculado.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToTransactions}
              className="text-xs font-semibold text-[#274A3C] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Abrir extrato</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#F2EFE9]">
            {sessionScanned.map((tx) => {
              const resolvedImg = resolveAssetUrl(tx.imageUrl);
              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {resolvedImg ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt({ ...tx, imageUrl: resolvedImg })}
                        className="w-10 h-10 rounded-xl overflow-hidden border border-[#E6E2D8] shrink-0 cursor-pointer"
                        title="Ampliar foto do recibo"
                      >
                        <img
                          src={resolvedImg}
                          alt={tx.description}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#FCF1ED] text-[#C96846] flex items-center justify-center shrink-0">
                        <CategoryIcon name={tx.category} className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#1A1C1A] truncate">
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#5C6661] mt-0.5 flex-wrap">
                        <span>{formatFriendlyDate(tx.date)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{tx.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{tx.account}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-[#1A1C1A] font-mono tabular-nums">
                      -{formatCurrency(tx.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      aria-label={`Editar ${tx.description}`}
                      className="p-1.5 text-[#5C6661] hover:text-[#1A1C1A] hover:bg-[#F2EFE9] rounded-lg cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
