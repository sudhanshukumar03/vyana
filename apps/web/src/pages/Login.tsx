import { useState, type FormEvent } from 'react';
import { Loader2, Mail, Lock } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { BrandLogo } from '../components/BrandLogo';

export default function Login() {
  const { login, register, authError } = useHealthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const isRegister = mode === 'register';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!email.trim() || !password) {
      setLocalError('Enter your email and password.');
      return;
    }
    if (isRegister && password.length < 8) {
      setLocalError('Choose a password with at least 8 characters.');
      return;
    }
    setBusy(true);
    const ok = isRegister
      ? await register(email.trim(), password)
      : await login(email.trim(), password);
    setBusy(false);
    // On failure, the store sets authError; nothing else to do here.
    if (!ok) return;
  };

  const error = localError || authError;
  const inputBase =
    'w-full pl-10 pr-3 py-2.5 rounded-xl border border-line bg-canvas text-[14px] text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand transition-colors';

  return (
    <div className="min-h-screen bg-canvas font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo variant="full" className="mb-7" />
          <h1 className="sr-only">{isRegister ? 'Create your Vyana account' : 'Sign in to Vyana'}</h1>
          <p className="text-[14px] text-muted">
            {isRegister ? 'Create your account to begin monitoring.' : 'Sign in to your health dashboard.'}
          </p>
        </div>

        <form onSubmit={submit} className="bg-surface rounded-2xl border border-line shadow-sm p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-[13px] font-semibold text-body mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputBase}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-semibold text-body mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
              <input
                id="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                className={inputBase}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-critical bg-critical-bg border border-critical/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white text-[14px] font-semibold hover:bg-brand-hover active:scale-[0.99] transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[13px] text-muted mt-5">
          {isRegister ? 'Already have an account?' : 'New to Vyana?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(isRegister ? 'login' : 'register');
              setLocalError('');
              useHealthStore.setState({ authError: '' });
            }}
            className="font-semibold text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:underline"
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>

        <p className="text-center text-[11px] text-muted mt-8 leading-relaxed">
          Vyana provides wellness insights only and is not a substitute for professional medical care.
        </p>
      </div>
    </div>
  );
}
