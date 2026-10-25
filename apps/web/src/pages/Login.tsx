import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { BrandLogo } from '../components/BrandLogo';
import { AuthBackdrop } from '../components/AuthBackdrop';
import './auth.css';

export default function Login() {
  const { login, register, authError } = useHealthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inFlight = useRef(false);

  const isRegister = mode === 'register';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setLocalError('');
    useHealthStore.setState({ authError: '' });
    if (!email.trim() || !password) {
      setLocalError('Enter your email and password.');
      return;
    }
    if (isRegister && password.length < 8) {
      setLocalError('Choose a password with at least 8 characters.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (isRegister) await register(email.trim(), password);
      else await login(email.trim(), password);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const error = localError || authError;

  return (
    <main className="auth-page" aria-labelledby="auth-heading">
      <h1 id="auth-heading" className="sr-only">{isRegister ? 'Create your Vyana account' : 'Sign in to Vyana'}</h1>
      <aside className="auth-story" aria-label="About Vyana">
        <AuthBackdrop />
        <BrandLogo variant="full" inverse className="auth-story-brand" />
        <div className="auth-story-copy">
          <h2 className="auth-story-title">Your health,<span>in harmony.</span></h2>
          <p className="auth-story-description">See your wellness trends, insights and progress — all in one place.</p>
        </div>
      </aside>

      <section className="auth-main" aria-label={isRegister ? 'Create account' : 'Sign in'}>
        <div className="auth-shell">
          <header className="auth-intro">
            <BrandLogo variant="auth" />
            <p className="auth-subtitle">
              {isRegister ? 'Create your account to begin monitoring.' : 'Sign in to your health dashboard.'}
            </p>
          </header>

        <form onSubmit={submit} className="auth-card" aria-busy={busy}>
          <div className="auth-fields">
          <div>
            <label htmlFor="email" className="auth-field-label">Email</label>
            <div className="auth-input-wrap">
              <Mail className="auth-field-icon" aria-hidden="true" />
              <input
                id="email"
                type="email"
                name="email"
                autoComplete={isRegister ? 'email' : 'username'}
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-describedby={error ? 'auth-error' : undefined}
                aria-invalid={Boolean(localError && !email.trim())}
                className="auth-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="auth-field-label">Password</label>
            <div className="auth-input-wrap">
              <Lock className="auth-field-icon" aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? '8+ characters' : 'Your password'}
                aria-describedby={error ? 'auth-error' : undefined}
                aria-invalid={Boolean(localError && (!password || (isRegister && password.length < 8)))}
                className="auth-input auth-input-password"
              />
              <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword} aria-controls="password" onClick={() => setShowPassword(value => !value)}>
                {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
              </button>
            </div>
          </div>
          </div>

          {error && (
            <p id="auth-error" role="alert" className="auth-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="auth-submit"
          >
            {busy && <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
            {busy ? isRegister ? 'Creating account…' : 'Signing in…' : isRegister ? 'Create account' : 'Sign in'}
            {!busy && <ArrowRight className="w-5 h-5" aria-hidden="true" />}
          </button>

        <p className="auth-mode">
          {isRegister ? 'Already have an account?' : 'New to Vyana?'}{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(isRegister ? 'login' : 'register');
              setLocalError('');
              setShowPassword(false);
              useHealthStore.setState({ authError: '' });
            }}
            className="auth-mode-switch"
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
        </form>

        <p role="status" className="sr-only">{busy ? isRegister ? 'Creating your account.' : 'Signing in to your account.' : ''}</p>
        <p className="auth-privacy"><ShieldCheck aria-hidden="true" /><span>Your dashboard is private to your account.</span></p>
        <p className="auth-disclaimer">
          Vyana provides wellness insights only and is not a substitute for professional medical care.
        </p>
        </div>
      </section>
    </main>
  );
}
