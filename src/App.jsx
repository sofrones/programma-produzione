import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPlants from './components/AdminPlants';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('produzione');

  useEffect(() => {
    // 1. Verifica se c'è già un utente autenticato
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Rimani in ascolto per i cambi di stato (Login / Logout)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Recupera il profilo (in particolare il ruolo) dell'utente autenticato
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, full_name, company_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Errore nel recupero del profilo:', error);
      setProfile(null);
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

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

  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      <div className="bg-gray-800 text-white px-6 py-2 flex justify-between items-center text-sm">
        <span>
          Utente autenticato: <strong>{session.user.email}</strong>
          {profile?.full_name && <span className="text-gray-300"> ({profile.full_name})</span>}
        </span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-medium text-xs transition"
        >
          Logout
        </button>
      </div>

      {isAdmin && (
        <div className="bg-white border-b flex gap-1 px-6">
          <button
            onClick={() => setActiveTab('produzione')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === 'produzione'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Programmazione
          </button>
          <button
            onClick={() => setActiveTab('amministrazione')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === 'amministrazione'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Amministrazione
          </button>
        </div>
      )}

      {activeTab === 'amministrazione' && isAdmin ? <AdminPlants /> : <Dashboard />}
    </div>
  );
}
