export default function AuthScreen({
  authForm,
  error,
  handleAuthSubmit,
  isRegistering,
  loading,
  onToggleRegistration,
  setAuthForm,
  success,
}) {
  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleAuthSubmit}>
        <div className="eyebrow">TaskFlow</div>
        <h1>{isRegistering ? 'Create your account' : 'Welcome back'}</h1>
        <p>
          {isRegistering
            ? 'Join the workspace and start managing tasks securely.'
            : 'Sign in to manage work, assignments, and deadlines.'}
        </p>

        {isRegistering && (
          <label>
            Full name
            <input
              value={authForm.full_name}
              required
              maxLength={100}
              onChange={(event) => setAuthForm({ ...authForm, full_name: event.target.value })}
              placeholder="Full name"
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={authForm.email}
            required
            maxLength={254}
            onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
            placeholder="admin@taskmanager.dev"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={authForm.password}
            required
            minLength={isRegistering ? 8 : 1}
            onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
            placeholder="Password"
          />
        </label>

        {error ? <div className="error-box" role="alert">{error}</div> : null}
        {success ? <div className="success-box" role="status">{success}</div> : null}

        <button type="submit" disabled={loading} className="primary-action">
          {loading ? (isRegistering ? 'Creating account...' : 'Signing in...') : isRegistering ? 'Create account' : 'Sign in'}
        </button>

        <button type="button" className="secondary-action" onClick={onToggleRegistration}>
          {isRegistering ? 'Have an account? Sign in' : 'Need an account? Register'}
        </button>
      </form>
    </div>
  );
}
