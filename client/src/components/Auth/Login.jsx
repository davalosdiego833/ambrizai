import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen" id="loginScreen">
      <div className="animated-bg">
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-glow"></div>
            <div className="logo-icon logo-md">A</div>
          </div>
          <h2 className="login-title gradient-text">Ambriz AI</h2>
          <p className="login-desc">Portal exclusivo para asesores</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="tu.nombre@ambriz.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className={`login-btn ${loading ? 'loading' : ''}`}
          disabled={loading}
        >
          Iniciar Sesión
        </button>

        <p className="login-footer">Promotoría Ambriz — SMNYL</p>
      </form>
    </div>
  );
}
