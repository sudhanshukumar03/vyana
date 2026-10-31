import { useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, ChartNoAxesCombined, Eye, EyeOff, Loader2, ShieldCheck, Info } from 'lucide-react';
import { useHealthStore } from '../store/useHealthStore';
import { BrandLogo } from '../components/BrandLogo';
import { AuthBackdrop } from '../components/AuthBackdrop';
import { AiRobotIcon } from '../components/AiRobotIcon';
import './auth.css';

export default function Login() {
  const login = useHealthStore(state => state.login);
  const register = useHealthStore(state => state.register);
  const authError = useHealthStore(state => state.authError);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
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
    if (isRegister) {
      if (password.length < 8) {
        setLocalError('Choose a password with at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      if (!termsAccepted) {
        setLocalError('Please accept the Terms of Service and Privacy Policy to continue.');
        return;
      }
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (isRegister) {
        const ok = await register(email.trim(), password);
        if (ok && fullName.trim()) {
          void useHealthStore.getState().saveProfile({ full_name: fullName.trim() });
        }
      } else {
        await login(email.trim(), password);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const toggleMode = () => {
    const nextMode = isRegister ? 'login' : 'register';
    setMode(nextMode);
    setLocalError('');
    setShowPassword(false);
    setConfirmPassword('');
    useHealthStore.setState({ authError: '' });
    requestAnimationFrame(() => heading.current?.focus());
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
          <li><AiRobotIcon className="w-4 h-4 rounded-xs" /><span>AI guidance</span></li>
        </ul>
      </aside>

      <section className="auth-main" aria-label={isRegister ? 'Create account' : 'Sign in'}>
        <div className="auth-shell">
          <header className="auth-intro">
            <h1 id="auth-heading" ref={heading} tabIndex={-1} className="auth-title">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="auth-subtitle">
              {isRegister ? 'Follow your daily vitals and see your health in perspective.' : 'Sign in to your personal health dashboard.'}
            </p>
          </header>

          <form onSubmit={submit} className="auth-card" aria-busy={busy}>
            <div className="auth-fields">
              {isRegister && (
                <div>
                  <label htmlFor="full-name" className="auth-field-label">Full Name</label>
                  <div className="auth-input-wrap">
                    <input
                      id="full-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={fullName}
                      onChange={event => setFullName(event.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="auth-input"
                    />
                  </div>
                </div>
              )}

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
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="auth-field-label mb-0">Password</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-brand hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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

              {isRegister && (
                <div>
                  <label htmlFor="confirm-password" className="auth-field-label">Confirm Password</label>
                  <div className="auth-input-wrap">
                    <input
                      id="confirm-password"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your password"
                      aria-describedby={error ? 'auth-error' : undefined}
                      aria-invalid={Boolean(localError && password !== confirmPassword)}
                      className="auth-input"
                    />
                  </div>
                </div>
              )}

              {isRegister && (
                <label className="flex items-start gap-2.5 text-xs text-muted cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-line text-brand focus:ring-brand"
                  />
                  <span>
                    I agree to the <span className="text-brand font-medium">Terms of Service</span> and acknowledge the <span className="text-brand font-medium">Privacy Policy</span>.
                  </span>
                </label>
              )}
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
                onClick={toggleMode}
                className="auth-mode-switch"
              >
                {isRegister ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </form>

          {showForgotModal && (
            <div className="mt-4 p-4 rounded-xl border border-line bg-surface-soft text-ink text-sm">
              <div className="flex items-center gap-2 font-semibold text-brand mb-1">
                <Info className="w-4 h-4" /> Password Recovery
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Password recovery links are sent to your registered email address. For self-hosted instances or clinic accounts, please contact your workspace administrator.
              </p>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="mt-3 text-xs font-semibold text-brand hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <p role="status" className="sr-only">{busy ? isRegister ? 'Creating your account.' : 'Signing in to your account.' : ''}</p>
          <p className="auth-privacy"><ShieldCheck aria-hidden="true" /><span>Your dashboard is private to your account.</span></p>
          <p className="auth-disclaimer">Wellness insights, not medical advice.<br />For medical concerns, speak with a qualified clinician.</p>
        </div>
      </section>
    </main>
  );
}
