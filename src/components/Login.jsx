import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    }
    // In caso di successo non serve fare altro: l'ascoltatore onAuthStateChange
    // in App.jsx aggiorna automaticamente la sessione e mostra la dashboard.
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      // Messaggio generico indipendentemente dall'esito reale: evita di rivelare
      // se un indirizzo email è registrato o meno nel sistema.
      setInfo(
        "Se l'indirizzo inserito è registrato, riceverai a breve una email con le istruzioni per reimpostare la password."
      );
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
        <div className="flex justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 48" width="210" height="48">
            <rect width="42" height="42" rx="10" fill="#2563eb" />
            <rect x="8" y="10" width="26" height="22" rx="3" fill="none" stroke="white" strokeWidth="2.4" />
            <line x1="8" y1="17" x2="34" y2="17" stroke="white" strokeWidth="2.4" />
            <line x1="14.5" y1="7" x2="14.5" y2="13" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="27.5" y1="7" x2="27.5" y2="13" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
            <polyline points="12,27.5 18,22 23,24.5 30,16.5" fill="none" stroke="#22c55e" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
            <text x="53" y="26" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="20" fill="#0f172a">NG <tspan fill="#64748b" fontWeight="500">Prog</tspan></text>
            <polyline points="53,34 72,31 93,34 124,26" fill="none" stroke="#22c55e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {mode === 'login' ? (
          <>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-6">Accedi al Sistema di Programmazione</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow disabled:opacity-50"
              >
                {loading ? 'Autenticazione in corso...' : 'Accedi'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Password dimenticata?
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-2">Recupera la password</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Inserisci la tua email: ti invieremo un link per impostarne una nuova.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded p-2">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow disabled:opacity-50"
              >
                {loading ? 'Invio in corso...' : 'Invia link di reset'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-center text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Torna al login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
