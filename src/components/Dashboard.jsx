import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';


// Inizializzazione Client Supabase con variabili d'ambiente Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Calcola quanti giorni ha davvero il mese selezionato (YYYY-MM),
// invece di assumere sempre 31 giorni fissi.
function getDaysInMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

// Formatta un numero con la virgola come separatore decimale (stile italiano)
function formatItalianNumber(num, decimals = 3) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '';
  return Number(num).toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Formatta il fattore di conversione mantenendo tutte le cifre decimali configurate,
// semplicemente sostituendo il punto con la virgola.
function formatFactor(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
}

export default function SupplierDashboard() {
  const [user, setUser] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [userAccessLevel, setUserAccessLevel] = useState('read'); // 'read' o 'write'

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUserDataAndPlants();
  }, []);

  useEffect(() => {
    if (selectedPlant) {
      fetchSchedules();
    }
  }, [selectedPlant, selectedMonth]);

  // Recupera utente e impianti per cui ha i permessi
  const fetchUserDataAndPlants = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data, error } = await supabase
        .from('user_plant_access')
        .select(`
          access_level,
          plants (
            id,
            name,
            conversion_factor_to_mwh,
            default_input_unit,
            daily_cutoff_time,
            daily_cutoff_days_before
          )
        `)
        .eq('user_id', user.id);

      // riga per il debug
       console.log("Dati ricevuti:", data, "Eventuale errore:", error);

      if (!error && data) {
        const plantList = data.map(item => ({
          ...item.plants,
          access_level: item.access_level
        }));
        setPlants(plantList);
        if (plantList.length > 0) {
          setSelectedPlant(plantList[0]);
          setUserAccessLevel(plantList[0].access_level);
        }
      }
    }
  };

  const handlePlantChange = (plantId) => {
    const plant = plants.find(p => p.id === parseInt(plantId));
    if (plant) {
      setSelectedPlant(plant);
      setUserAccessLevel(plant.access_level);
    }
  };

  // Data un valore in MWh, calcola quanto varrebbe nell'unità di misura propria
  // dell'impianto (usata per mostrare un valore "inserito" anche sulle righe
  // generate automaticamente dal sistema, che salvano solo il valore in MWh).
  const mwhToPlantUnit = (mwhValue, plant) => {
    const factor = parseFloat(plant?.conversion_factor_to_mwh) || 1;
    if (mwhValue === null || mwhValue === undefined) return null;
    return Number(mwhValue) / factor;
  };

  const fetchSchedules = async () => {
    setLoading(true);
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-${String(getDaysInMonth(selectedMonth)).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('production_schedules')
      .select('*')
      .eq('plant_id', selectedPlant.id)
      .gte('production_date', startDate)
      .lte('production_date', endDate)
      .order('production_date', { ascending: true });

    if (!error) {
      const withDisplay = (data || []).map((row) => {
        const unitValue = row.raw_input_value ?? mwhToPlantUnit(row.forecast_value, selectedPlant);
        return {
          ...row,
          display_value: unitValue !== null ? formatItalianNumber(unitValue) : ''
        };
      });
      setSchedules(withDisplay);
    } else {
      // Prima non veniva segnalato nulla in caso di errore: la tabella restava
      // silenziosamente vuota. Ora almeno lo vediamo a schermo.
      setMessage(`Errore nel caricamento della programmazione: ${error.message}`);
    }
    setLoading(false);
  };

  // Verifico se la modifica è consentita rispetto al cutoff orario italiano
  const isDateEditable = (productionDateStr) => {
    if (userAccessLevel !== 'write') return false;

    const [year, month, day] = productionDateStr.split('-').map(Number);
    const prodDate = new Date(year, month - 1, day);

    const cutoffDays = selectedPlant.daily_cutoff_days_before || 1;
    const deadline = new Date(prodDate);
    deadline.setDate(deadline.getDate() - cutoffDays);

    const [hours, minutes] = (selectedPlant.daily_cutoff_time || '12:00:00').split(':').map(Number);
    deadline.setHours(hours, minutes, 0, 0);

    const nowItaly = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));

    return nowItaly < deadline;
  };

  // rawValue è il testo digitato dall'utente (accetta sia virgola che punto
  // come separatore decimale). L'unità è sempre quella dell'impianto: non
  // esiste più una scelta libera che potesse generare valori misti.
  const handleValueChange = (dateStr, rawValue) => {
    const normalized = rawValue.replace(',', '.');
    const numericVal = parseFloat(normalized) || 0;
    const factor = parseFloat(selectedPlant.conversion_factor_to_mwh) || 1;
    const calculatedMwh = numericVal * factor;
    const unit = selectedPlant.default_input_unit;

    setSchedules(prev => {
      const index = prev.findIndex(item => item.production_date === dateStr);
      const updated = [...prev];
      if (index >= 0) {
        updated[index] = {
          ...updated[index],
          raw_input_value: numericVal,
          display_value: rawValue,
          input_unit: unit,
          applied_conversion_factor: factor,
          forecast_value: calculatedMwh,
          is_dirty: true
        };
      } else {
        updated.push({
          plant_id: selectedPlant.id,
          production_date: dateStr,
          raw_input_value: numericVal,
          display_value: rawValue,
          input_unit: unit,
          applied_conversion_factor: factor,
          forecast_value: calculatedMwh,
          source_type: 'manual',
          is_dirty: true
        });
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage('');

    const modifiedItems = schedules.filter(item => item.is_dirty);

    for (const item of modifiedItems) {
      const payload = {
        plant_id: selectedPlant.id,
        production_date: item.production_date,
        forecast_value: item.forecast_value,
        raw_input_value: item.raw_input_value,
        input_unit: item.input_unit,
        applied_conversion_factor: item.applied_conversion_factor,
        source_type: item.source_type || 'manual',
        updated_by: user?.id
      };

      const { error } = await supabase
        .from('production_schedules')
        .upsert(payload, { onConflict: 'plant_id, production_date' });

      if (error) {
        setMessage(`Errore durante il salvataggio per il giorno ${item.production_date}:${error.message}`);
        setLoading(false);
        return;
      }
    }

    setMessage('Programmazione salvata con successo!');
    fetchSchedules();
    setLoading(false);
  };

  const unitLabel = selectedPlant?.default_input_unit || '';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Programmazione Produzione</h1>
            <p className="text-sm text-gray-500">Gestione e inserimento previsioni energetiche</p>
          </div>

          <div className="mt-4 md:mt-0 w-full md:w-auto">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Seleziona Impianto</label>
            <select
              value={selectedPlant?.id || ''}
              onChange={(e) => handlePlantChange(e.target.value)}
              className="w-full md:w-64 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {plants.length === 0 && <option value="">Nessun impianto disponibile</option>}
              {plants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedPlant && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex flex-wrap justify-between items-center text-sm">
            <div>
              <span className="font-semibold text-blue-900">Permesso: </span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${userAccessLevel === 'write' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {userAccessLevel === 'write' ? 'Scrittura' : 'Sola Lettura'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-blue-900">Cutoff Orario: </span>
              <span>Ore {selectedPlant.daily_cutoff_time} (G-{selectedPlant.daily_cutoff_days_before})</span>
            </div>
            <div>
              <span className="font-semibold text-blue-900">Conversione: </span>
              <span>1 {unitLabel} = {formatFactor(selectedPlant.conversion_factor_to_mwh)} MWh_pcs</span>
            </div>
          </div>
        )}

        <div className="mb-6 max-w-xs">
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mese di Riferimento</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b text-xs text-gray-600">
                <th className="p-3 font-semibold">Data</th>
                <th className="p-3 font-semibold">VALORE INSERITO ({unitLabel})</th>
                <th className="p-3 font-semibold">EQUIVALENTE (MWh)</th>
                <th className="p-3 font-semibold">Stato</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: getDaysInMonth(selectedMonth) }, (_, i) => {
                const dayNum = String(i + 1).padStart(2, '0');
                const dateStr = `${selectedMonth}-${dayNum}`;
                const record = schedules.find(s => s.production_date === dateStr);
                const editable = selectedPlant ? isDateEditable(dateStr) : true;

                return (
                  <tr key={dateStr} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-700">{dateStr}</td>
                    <td className="p-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={!editable}
                        value={record?.display_value ?? ''}
                        onChange={(e) => handleValueChange(dateStr, e.target.value)}
                        className={`w-32 p-1.5 border rounded ${editable ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                        placeholder="0,000"
                      />
                    </td>
                    <td className="p-3 font-semibold text-gray-800">
                      {record?.forecast_value ? formatItalianNumber(record.forecast_value) : '0,000'} MWh
                    </td>
                    <td className="p-3">
                      {editable ? (
                        <span className="text-xs text-green-600 font-medium">Modificabile</span>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium flex items-center">🔒 Bloccato</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center">
          {message && <p className="text-sm font-medium text-blue-600">{message}</p>}
          <button
            onClick={handleSave}
            disabled={loading || userAccessLevel !== 'write'}
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Salva Programmazione'}
          </button>
        </div>

      </div>
    </div>
  );
}
