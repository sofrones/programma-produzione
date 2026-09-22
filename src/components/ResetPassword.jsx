import { useState } from 'react';
import { supabase } from '../supabaseClient';

// Mostrata quando l'utente arriva dal link "Password dimenticata?" ricevuto via
// email: Supabase, cliccando quel link, apre una sessione di recovery temporanea
// e App.jsx intercetta l'evento PASSWORD_RECOVERY per mostrare questo componente
// al posto della dashboard, finché non viene impostata una nuova password.
export default function ResetPassword({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La password deve contenere almeno 6 caratteri.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le due password non coincidono.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
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

        {done ? (
          <>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-3">Password aggiornata</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              La tua password è stata impostata correttamente.
            </p>
            <button
              onClick={onSuccess}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow"
            >
              Continua
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-800 text-center mb-6">Imposta una nuova password</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nuova password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Conferma password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                {loading ? 'Salvataggio in corso...' : 'Imposta nuova password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
