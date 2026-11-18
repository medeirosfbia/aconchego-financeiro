import React, { useState } from 'react';
import {
  Sparkles,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  ArrowRight,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export type AuthMode = 'login' | 'signup' | 'reset' | 'update_password';

interface AuthViewProps {
  initialMode?: AuthMode;
  onEnterDemoMode: () => void;
  onPasswordUpdated?: () => void;
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira seus dados e tente novamente.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou pasta de spam.';
  }
  if (lower.includes('user already registered')) {
    return 'Já existe uma conta cadastrada com este e-mail. Tente entrar ou recuperar sua senha.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Limite temporário de envio de e-mails atingido no Supabase Auth. Aguarde alguns instantes antes de tentar novamente.';
  }
  if (lower.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  return message || 'Não foi possível concluir a autenticação. Tente novamente.';
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialMode = 'login',
  onEnterDemoMode,
  onPasswordUpdated,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMsg(
        'O Supabase não está configurado neste ambiente (.env). Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY ou explore o Modo Demonstração abaixo.'
      );
      return;
    }

    if (mode !== 'update_password' && (!email.trim() || !email.includes('@'))) {
      setErrorMsg('Informe um endereço de e-mail válido.');
      return;
    }

    if (mode === 'login' || mode === 'signup' || mode === 'update_password') {
      if (password.length < 6) {
        setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setErrorMsg('Informe seu nome para personalizar sua experiência.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }
    }

    if (mode === 'update_password' && password !== confirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSuccessMsg(
            'Conta criada! Enviamos um e-mail de confirmação para concluir o acesso. Verifique sua caixa de entrada.'
          );
          setMode('login');
        }
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMsg(
          'Se existir uma conta associada a este e-mail, enviaremos um link de recuperação de senha.'
        );
      } else if (mode === 'update_password') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setSuccessMsg('Senha atualizada com sucesso!');
        onPasswordUpdated?.();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Erro desconhecido na autenticação.';
      setErrorMsg(translateAuthError(raw));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1C1A] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#274A3C] text-[#C4EBD8] flex items-center justify-center mx-auto shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1C1A]">
            Aconchego Finanças
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6661] max-w-sm mx-auto">
            Controle financeiro pessoal simples, acolhedor e seguro, com leitor inteligente de recibos e Assistente IA.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#FFFFFF] rounded-3xl border border-[#EAE6DE] shadow-sm p-5 sm:p-7 space-y-5">
          {mode !== 'update_password' && (
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F2EFE9] rounded-2xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  resetMessages();
                }}
                className={`py-2 rounded-xl transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-[#274A3C] shadow-xs'
                    : 'text-[#5C6661] hover:text-[#1A1C1A]'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  resetMessages();
                }}
                className={`py-2 rounded-xl transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-[#274A3C] shadow-xs'
                    : 'text-[#5C6661] hover:text-[#1A1C1A]'
                }`}
              >
                Criar Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  resetMessages();
                }}
                className={`py-2 rounded-xl transition-colors cursor-pointer ${
                  mode === 'reset'
                    ? 'bg-white text-[#274A3C] shadow-xs'
                    : 'text-[#5C6661] hover:text-[#1A1C1A]'
                }`}
              >
                Recuperar
              </button>
            </div>
          )}

          {mode === 'update_password' && (
            <div className="flex items-center gap-2 text-sm font-bold text-[#274A3C]">
              <KeyRound className="w-4 h-4" />
              <span>Definir Nova Senha</span>
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="p-3 rounded-2xl bg-[#FCF1ED] border border-[#F5D3C4] text-[11px] text-[#954827] leading-relaxed">
              <strong>Ambiente sem credenciais Supabase:</strong> configure{' '}
              <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no arquivo{' '}
              <code>.env</code> para habilitar cadastro e login reais, ou utilize o{' '}
              <strong>Modo Demonstração</strong> abaixo.
            </div>
          )}

          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-[#FDF0ED] border border-[#F5C2B8] text-[#BA1A1A] text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div role="status" className="p-3 rounded-xl bg-[#EDF5F0] border border-[#B9DCC7] text-[#274A3C] text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#5C6661] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    placeholder="Como prefere ser chamado(a)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                  />
                </div>
              </div>
            )}

            {mode !== 'update_password' && (
              <div>
                <label htmlFor="auth-email" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5C6661] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'update_password') && (
              <div>
                <label htmlFor="auth-password" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  {mode === 'update_password' ? 'Nova senha' : 'Senha'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5C6661] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="Mínimo de 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                  />
                </div>
              </div>
            )}

            {(mode === 'signup' || mode === 'update_password') && (
              <div>
                <label htmlFor="auth-confirm" className="block text-xs font-bold text-[#1A1C1A] mb-1">
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5C6661] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F6] border border-[#E6E2D8] rounded-xl text-sm focus:outline-none focus:border-[#3F6253] text-[#1A1C1A]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !isSupabaseConfigured}
              className="w-full py-3 px-4 rounded-full bg-[#274A3C] hover:bg-[#1E3B30] text-white text-sm font-bold shadow-sm transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {isLoading
                  ? 'Aguarde...'
                  : mode === 'login'
                  ? 'Entrar no Aconchego'
                  : mode === 'signup'
                  ? 'Criar Conta Gratuita'
                  : mode === 'reset'
                  ? 'Enviar Link de Recuperação'
                  : 'Salvar Nova Senha'}
              </span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="pt-2 border-t border-[#F2EFE9] flex items-center gap-2 text-[11px] text-[#5C6661]">
            <ShieldCheck className="w-4 h-4 text-[#437A5B] shrink-0" />
            <span>
              Seus dados financeiros ficam isolados por usuário via Row Level Security (RLS) e nunca vêm preenchidos com exemplos fictícios.
            </span>
          </div>
        </div>

        {/* Voluntary Demo Mode Box */}
        <div className="bg-[#F4F3F0] rounded-2xl border border-[#E6E2D8] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold text-[#1A1C1A] flex items-center justify-center sm:justify-start gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-[#954827]" />
              <span>Quer conhecer a interface antes de criar conta?</span>
            </p>
            <p className="text-[11px] text-[#5C6661] mt-0.5">
              O Modo Demonstração carrega dados fictícios apenas localmente nesta sessão.
            </p>
          </div>
          <button
            type="button"
            onClick={onEnterDemoMode}
            className="px-4 py-2 rounded-full bg-[#FFFFFF] border border-[#D9D5CC] hover:bg-[#FAF9F6] text-xs font-semibold text-[#274A3C] whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
          >
            Explorar em Modo Demonstração
          </button>
        </div>
      </div>
    </div>
  );
};
