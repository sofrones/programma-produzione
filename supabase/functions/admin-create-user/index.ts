// Edge Function: admin-create-user
//
// Invitata dal pannello Amministrazione (AdminPlants.jsx) per creare un nuovo
// utente (invito via email, senza che l'admin debba conoscerne la password)
// e assegnargli in un unico passaggio gli impianti di competenza con il
// relativo livello di accesso (read/write) in user_plant_access.
//
// La service_role key non è mai esposta al frontend: vive solo qui, come
// variabile d'ambiente automaticamente disponibile alle Edge Function di Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Autenticazione mancante.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Client "per conto" di chi chiama: serve solo a verificare chi è
    // e che ruolo ha, rispettando le normali regole RLS.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const {
      data: { user: caller },
      error: callerError
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return jsonResponse({ error: 'Sessione non valida.' }, 401);
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (profileError || callerProfile?.role !== 'admin') {
      return jsonResponse({ error: 'Operazione riservata agli amministratori.' }, 403);
    }

    const body = await req.json();
    const { email, full_name, company_name, role, plants } = body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return jsonResponse({ error: 'Email non valida.' }, 400);
    }
    if (!Array.isArray(plants) || plants.length === 0) {
      return jsonResponse({ error: 'Seleziona almeno un impianto da assegnare.' }, 400);
    }
    for (const p of plants) {
      if (!p.plant_id || !['read', 'write'].includes(p.access_level)) {
        return jsonResponse({ error: 'Elenco impianti non valido.' }, 400);
      }
    }

    // Da qui in poi operiamo con la service_role key: bypassa la RLS,
    // per questo tutta la parte sopra di verifica del chiamante è essenziale.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name || null,
        company_name: company_name || null,
        role: role || 'fornitore'
      }
    });

    if (inviteError) {
      return jsonResponse({ error: `Invito non riuscito: ${inviteError.message}` }, 400);
    }

    const newUserId = inviteData.user.id;

    // Il trigger handle_new_user() crea già la riga in profiles a questo punto.
    const accessRows = plants.map((p) => ({
      user_id: newUserId,
      plant_id: p.plant_id,
      access_level: p.access_level
    }));

    const { error: accessError } = await adminClient.from('user_plant_access').insert(accessRows);

    if (accessError) {
      // L'utente è stato comunque creato e invitato: lo segnaliamo con chiarezza
      // così l'admin sa che deve assegnare gli impianti a mano da "Gestisci permessi".
      return jsonResponse(
        {
          error: `Utente invitato, ma l'assegnazione impianti non è riuscita (${accessError.message}). Assegna gli impianti manualmente da "Gestisci permessi".`,
          user_id: newUserId
        },
        207
      );
    }

    return jsonResponse({ success: true, user_id: newUserId });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Errore interno.' }, 500);
  }
});
