import { useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, Bot, ChartNoAxesCombined, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { BrandLogo } from '../components/BrandLogo';
import { AuthBackdrop } from '../components/AuthBackdrop';
import './auth.css';

export default function Login() {
  const login = useHealthStore(state => state.login);
  const register = useHealthStore(state => state.register);
  const authError = useHealthStore(state => state.authError);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const isRegister = mode === 'register';
  const error = localError || authError;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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

  return (
    <main className="auth-page" aria-labelledby="auth-heading">
      <aside className="auth-story" aria-label="About Vyana">
        <AuthBackdrop />
        <BrandLogo variant="auth" inverse className="auth-story-brand" />
        <div className="auth-story-copy">
          <p className="auth-story-title">Your health,<br />in harmony.</p>
          <p className="auth-story-description">A clearer view of your vitals, trends<br className="auth-story-break" /> and everyday wellbeing.</p>
        </div>
        <ul className="auth-story-features" aria-label="What you can follow with Vyana">
          <li><Activity aria-hidden="true" /><span>Daily vitals</span></li>
          <li><ChartNoAxesCombined aria-hidden="true" /><span>Personal trends</span></li>
          <li><Bot aria-hidden="true" /><span>AI guidance</span></li>
        </ul>
      </aside>

      <section className="auth-main" aria-label={isRegister ? 'Create account' : 'Sign in'}>
        <div className="auth-shell">
          <header className="auth-intro">
            <h1 id="auth-heading" ref={heading} tabIndex={-1} className="auth-title">{isRegister ? 'Create your account.' : 'Welcome back.'}</h1>
            <p className="auth-subtitle">
              {isRegister ? 'Follow your daily vitals and see your health in perspective.' : 'Sign in to your personal health dashboard.'}
            </p>
          </header>

          <form onSubmit={submit} className="auth-card" aria-busy={busy}>
            <div className="auth-fields">
              <div>
                <label htmlFor="email" className="auth-field-label">Email</label>
                <div className="auth-input-wrap">
                  <input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete={isRegister ? 'email' : 'username'}
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={event => setEmail(event.target.value)}
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
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder={isRegister ? '8+ characters' : 'Your password'}
                    aria-describedby={error ? 'auth-error' : undefined}
                    aria-invalid={Boolean(localError && (!password || (isRegister && password.length < 8)))}
                    className="auth-input auth-input-password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    onClick={() => setShowPassword(value => !value)}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>

            {error && <p id="auth-error" role="alert" className="auth-error">{error}</p>}

            <button type="submit" disabled={busy} className="auth-submit">
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              <span>{busy ? isRegister ? 'Creating account…' : 'Signing in…' : isRegister ? 'Create account' : 'Sign in'}</span>
              {!busy && <ArrowRight aria-hidden="true" />}
            </button>

            <p className="auth-mode">
              <span>{isRegister ? 'Already have an account?' : 'New to Vyana?'}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode(isRegister ? 'login' : 'register');
                  setLocalError('');
                  setShowPassword(false);
                  useHealthStore.setState({ authError: '' });
                  requestAnimationFrame(() => heading.current?.focus());
                }}
                className="auth-mode-switch"
              >
                {isRegister ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </form>

          <p role="status" className="sr-only">{busy ? isRegister ? 'Creating your account.' : 'Signing in to your account.' : ''}</p>
          <p className="auth-privacy"><ShieldCheck aria-hidden="true" /><span>Your dashboard is private to your account.</span></p>
          <p className="auth-disclaimer">Wellness insights, not medical advice.<br />For medical concerns, speak with a qualified clinician.</p>
        </div>
      </section>
    </main>
  );
}
