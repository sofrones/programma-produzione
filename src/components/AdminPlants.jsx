import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const emptyPlantForm = {
  name: '',
  monthly_deadline_day: 5,
  daily_cutoff_time: '12:00',
  daily_cutoff_days_before: 1,
  default_daily_production: 0,
  conversion_factor_to_mwh: 1,
  default_input_unit: 'MWh',
  notification_emails: ''
};

export default function AdminPlants() {
  const [plants, setPlants] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [accesses, setAccesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyPlantForm);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(emptyPlantForm);

  const [selectedPlantForAccess, setSelectedPlantForAccess] = useState(null);
  const [newAccessUserId, setNewAccessUserId] = useState('');
  const [newAccessLevel, setNewAccessLevel] = useState('read');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError('');

    const [plantsRes, profilesRes, accessesRes] = await Promise.all([
      supabase.from('plants').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, company_name, role').order('full_name'),
      supabase.from('user_plant_access').select('id, user_id, plant_id, access_level')
    ]);

    if (plantsRes.error) setError(plantsRes.error.message);
    else setPlants(plantsRes.data || []);

    if (!profilesRes.error) setProfiles(profilesRes.data || []);
    if (!accessesRes.error) setAccesses(accessesRes.data || []);

    setLoading(false);
  };

  const emailsToArray = (text) =>
    text
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

  const emailsToText = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');

  const startEdit = (plant) => {
    setEditingId(plant.id);
    setEditForm({
      name: plant.name,
      monthly_deadline_day: plant.monthly_deadline_day,
      daily_cutoff_time: plant.daily_cutoff_time?.slice(0, 5) || '12:00',
      daily_cutoff_days_before: plant.daily_cutoff_days_before,
      default_daily_production: plant.default_daily_production,
      conversion_factor_to_mwh: plant.conversion_factor_to_mwh,
      default_input_unit: plant.default_input_unit,
      notification_emails: emailsToText(plant.notification_emails)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyPlantForm);
  };

  const saveEdit = async (plantId) => {
    setMessage('');
    setError('');
    const payload = {
      name: editForm.name,
      monthly_deadline_day: parseInt(editForm.monthly_deadline_day, 10),
      daily_cutoff_time: editForm.daily_cutoff_time,
      daily_cutoff_days_before: parseInt(editForm.daily_cutoff_days_before, 10),
      default_daily_production: parseFloat(editForm.default_daily_production),
      conversion_factor_to_mwh: parseFloat(editForm.conversion_factor_to_mwh),
      default_input_unit: editForm.default_input_unit,
      notification_emails: emailsToArray(editForm.notification_emails)
    };

    const { error } = await supabase.from('plants').update(payload).eq('id', plantId);

    if (error) {
      setError(`Errore durante il salvataggio: ${error.message}`);
      return;
    }

    setMessage('Impianto aggiornato con successo.');
    setEditingId(null);
    fetchAll();
  };

  const createPlant = async () => {
    setMessage('');
    setError('');

    if (!newForm.name.trim()) {
      setError('Il nome impianto è obbligatorio.');
      return;
    }

    const payload = {
      name: newForm.name,
      monthly_deadline_day: parseInt(newForm.monthly_deadline_day, 10),
      daily_cutoff_time: newForm.daily_cutoff_time,
      daily_cutoff_days_before: parseInt(newForm.daily_cutoff_days_before, 10),
      default_daily_production: parseFloat(newForm.default_daily_production),
      conversion_factor_to_mwh: parseFloat(newForm.conversion_factor_to_mwh),
      default_input_unit: newForm.default_input_unit,
      notification_emails: emailsToArray(newForm.notification_emails)
    };

    const { error } = await supabase.from('plants').insert(payload);

    if (error) {
      setError(`Errore durante la creazione: ${error.message}`);
      return;
    }

    setMessage('Impianto creato con successo.');
    setNewForm(emptyPlantForm);
    setShowNewForm(false);
    fetchAll();
  };

  const deletePlant = async (plantId, plantName) => {
    if (!window.confirm(`Eliminare definitivamente l'impianto "${plantName}"? Questa azione non è reversibile.`)) {
      return;
    }
    setMessage('');
    setError('');

    const { error } = await supabase.from('plants').delete().eq('id', plantId);

    if (error) {
      setError(`Impossibile eliminare l'impianto: ${error.message}`);
      return;
    }

    setMessage('Impianto eliminato.');
    fetchAll();
  };

  const accessesForPlant = (plantId) => accesses.filter((a) => a.plant_id === plantId);

  const profileLabel = (userId) => {
    const p = profiles.find((pr) => pr.id === userId);
    if (!p) return userId;
    return `${p.full_name || 'Senza nome'}${p.company_name ? ' — ' + p.company_name : ''}`;
  };

  const addAccess = async (plantId) => {
    if (!newAccessUserId) {
      setError("Seleziona un utente prima di aggiungere l'accesso.");
      return;
    }
    setMessage('');
    setError('');

    const { error } = await supabase.from('user_plant_access').insert({
      plant_id: plantId,
      user_id: newAccessUserId,
      access_level: newAccessLevel
    });

    if (error) {
      setError(`Errore nell'assegnazione: ${error.message}`);
      return;
    }

    setMessage('Accesso assegnato.');
    setNewAccessUserId('');
    setNewAccessLevel('read');
    fetchAll();
  };

  const removeAccess = async (accessId) => {
    setMessage('');
    setError('');

    const { error } = await supabase.from('user_plant_access').delete().eq('id', accessId);

    if (error) {
      setError(`Errore nella rimozione: ${error.message}`);
      return;
    }

    fetchAll();
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Caricamento anagrafica in corso...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Anagrafica Impianti</h1>
            <p className="text-sm text-gray-500">Gestione impianti e permessi di accesso</p>
          </div>
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow text-sm"
          >
            {showNewForm ? 'Annulla' : '+ Nuovo Impianto'}
          </button>
        </div>

        {message && (
          <p className="mb-4 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded p-2">
            {message}
          </p>
        )}
        {error && (
          <p className="mb-4 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}

        {showNewForm && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-blue-900 mb-3">Nuovo impianto</h2>
            <PlantForm form={newForm} setForm={setNewForm} />
            <button
              onClick={createPlant}
              className="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
            >
              Crea impianto
            </button>
          </div>
        )}

        <div className="space-y-4">
          {plants.map((plant) => (
            <div key={plant.id} className="border border-gray-200 rounded-lg p-4">
              {editingId === plant.id ? (
                <>
                  <PlantForm form={editForm} setForm={setEditForm} />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => saveEdit(plant.id)}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-4 rounded-lg text-sm"
                    >
                      Salva
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-1.5 px-4 rounded-lg text-sm"
                    >
                      Annulla
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-gray-800">{plant.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Scadenza mensile: giorno {plant.monthly_deadline_day} del mese precedente ·{' '}
                        Cutoff giornaliero: ore {plant.daily_cutoff_time} (G-{plant.daily_cutoff_days_before}) ·{' '}
                        Default: {plant.default_daily_production} {plant.default_input_unit} ·{' '}
                        Fattore MWh: {plant.conversion_factor_to_mwh}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Email notifica:{' '}
                        {plant.notification_emails?.length ? plant.notification_emails.join(', ') : 'nessuna'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(plant)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => deletePlant(plant.id, plant.name)}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 rounded px-3 py-1"
                      >
                        Elimina
                      </button>
                      <button
                        onClick={() =>
                          setSelectedPlantForAccess(selectedPlantForAccess === plant.id ? null : plant.id)
                        }
                        className="text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-300 rounded px-3 py-1"
                      >
                        {selectedPlantForAccess === plant.id ? 'Chiudi permessi' : 'Gestisci permessi'}
                      </button>
                    </div>
                  </div>

                  {selectedPlantForAccess === plant.id && (
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Utenti con accesso</h4>
                      {accessesForPlant(plant.id).length === 0 && (
                        <p className="text-xs text-gray-500 mb-3">
                          Nessun utente ha ancora accesso a questo impianto.
                        </p>
                      )}
                      <ul className="space-y-1 mb-3">
                        {accessesForPlant(plant.id).map((a) => (
                          <li
                            key={a.id}
                            className="flex justify-between items-center text-sm bg-white border border-gray-200 rounded px-3 py-1.5"
                          >
                            <span>
                              {profileLabel(a.user_id)}{' '}
                              <span
                                className={`ml-2 text-xs font-bold px-2 py-0.5 rounded ${
                                  a.access_level === 'write'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {a.access_level === 'write' ? 'Scrittura' : 'Sola lettura'}
                              </span>
                            </span>
                            <button
                              onClick={() => removeAccess(a.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                              Rimuovi
                            </button>
                          </li>
                        ))}
                      </ul>

                      <div className="flex flex-wrap gap-2 items-center">
                        <select
                          value={newAccessUserId}
                          onChange={(e) => setNewAccessUserId(e.target.value)}
                          className="p-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Seleziona utente...</option>
                          {profiles
                            .filter((p) => !accessesForPlant(plant.id).some((a) => a.user_id === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.full_name || p.id} {p.company_name ? `— ${p.company_name}` : ''}
                              </option>
                            ))}
                        </select>
                        <select
                          value={newAccessLevel}
                          onChange={(e) => setNewAccessLevel(e.target.value)}
                          className="p-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="read">Sola lettura</option>
                          <option value="write">Scrittura</option>
                        </select>
                        <button
                          onClick={() => addAccess(plant.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1.5 px-3 rounded"
                        >
                          Assegna accesso
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {plants.length === 0 && (
            <p className="text-sm text-gray-500">Nessun impianto in anagrafica. Creane uno con il pulsante in alto.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlantForm({ form, setForm }) {
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nome impianto</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
          Giorno scadenza mensile (mese M-1)
        </label>
        <input
          type="number"
          min="1"
          max="31"
          value={form.monthly_deadline_day}
          onChange={(e) => update('monthly_deadline_day', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Orario cutoff giornaliero</label>
        <input
          type="time"
          value={form.daily_cutoff_time}
          onChange={(e) => update('daily_cutoff_time', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Giorni prima (cutoff G-x)</label>
        <input
          type="number"
          min="0"
          value={form.daily_cutoff_days_before}
          onChange={(e) => update('daily_cutoff_days_before', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
          Valore giornaliero di default
        </label>
        <input
          type="number"
          step="0.001"
          value={form.default_daily_production}
          onChange={(e) => update('default_daily_production', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Unità di misura di default</label>
        <select
          value={form.default_input_unit}
          onChange={(e) => update('default_input_unit', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        >
          <option value="MWh">MWh</option>
          <option value="kWh">kWh</option>
          <option value="Sm3">Sm3</option>
          <option value="Nm3">Nm3</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
          Fattore conversione a MWh
        </label>
        <input
          type="number"
          step="0.000001"
          value={form.conversion_factor_to_mwh}
          onChange={(e) => update('conversion_factor_to_mwh', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
          Email di notifica (separate da virgola)
        </label>
        <input
          type="text"
          value={form.notification_emails}
          onChange={(e) => update('notification_emails', e.target.value)}
          placeholder="mario.rossi@esempio.it, admin@esempio.it"
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
    </div>
  );
}
