import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPlants from './components/AdminPlants';
import ResetPassword from './components/ResetPassword';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('produzione');
  const [passwordRecovery, setPasswordRecovery] = useState(false);

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

    // 2. Rimani in ascolto per i cambi di stato (Login / Logout / recupero password)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === 'PASSWORD_RECOVERY') {
        // L'utente ha cliccato il link "Password dimenticata?" ricevuto via email:
        // Supabase ha già creato una sessione temporanea di recovery. Mostriamo il
        // form per la nuova password invece della dashboard, senza caricare il profilo.
        setPasswordRecovery(true);
        setLoading(false);
        return;
      }

      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Chiamata quando l'utente ha impostato con successo la nuova password:
  // esce dalla schermata di recovery e prosegue nel normale flusso dell'app.
  const handleRecoveryDone = () => {
    setPasswordRecovery(false);
    if (session) {
      setLoading(true);
      fetchProfile(session.user.id);
    } else {
      setLoading(false);
    }
  };

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

  // Utente arrivato dal link di recupero password: mostra il form dedicato
  // prima di qualunque altra cosa, anche se una sessione (temporanea) esiste già.
  if (passwordRecovery) {
    return <ResetPassword onSuccess={handleRecoveryDone} />;
  }

  // Se l'utente non è loggato, mostra la pagina di Login
  if (!session) {
    return <Login />;
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      <div className="bg-gray-800 text-white px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
        <div className="flex items-center justify-between sm:justify-start">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 48" className="h-7 sm:h-9 md:h-10 lg:h-12 w-auto">
            <rect width="42" height="42" rx="10" fill="#3b82f6" />
            <rect x="8" y="10" width="26" height="22" rx="3" fill="none" stroke="white" strokeWidth="2.4" />
            <line x1="8" y1="17" x2="34" y2="17" stroke="white" strokeWidth="2.4" />
            <line x1="14.5" y1="7" x2="14.5" y2="13" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="27.5" y1="7" x2="27.5" y2="13" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
            <polyline points="12,27.5 18,22 23,24.5 30,16.5" fill="none" stroke="#4ade80" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
            <text x="53" y="26" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="20" fill="white">NG <tspan fill="#cbd5e1" fontWeight="500">Prog</tspan></text>
            <polyline points="53,34 72,31 93,34 124,26" fill="none" stroke="#4ade80" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <button
            onClick={() => supabase.auth.signOut()}
            className="sm:hidden bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-medium text-xs transition"
          >
            Logout
          </button>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 min-w-0">
          <span className="truncate min-w-0 text-xs sm:text-sm">
            Utente autenticato: <strong>{session.user.email}</strong>
            {profile?.full_name && <span className="text-gray-300"> ({profile.full_name})</span>}
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="hidden sm:inline-block shrink-0 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-medium text-xs transition"
          >
            Logout
          </button>
        </div>
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
