import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Verifica se c'è già un utente autenticato
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Rimani in ascolto per i cambi di stato (Login / Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 font-medium">
        Caricamento sessione in corso...
      </div>
    );
  }

  // Se l'utente non è loggato, mostra la pagina di Login
  if (!session) {
    return <Login />;
  }

  // Se l'utente è loggato, mostra la Dashboard con il pulsante Logout in alto
  return (
    <div>
      <div className="bg-gray-800 text-white px-6 py-2 flex justify-between items-center text-sm">
        <span>Utente autenticato: <strong>{session.user.email}</strong></span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-medium text-xs transition"
        >
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  );
}