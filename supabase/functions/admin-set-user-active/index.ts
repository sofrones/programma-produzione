// Edge Function: admin-set-user-active
//
// Invocata dal pannello Amministrazione (AdminPlants.jsx, sezione "Elenco utenti")
// per disattivare o riattivare un utente SENZA mai cancellarne la riga in profiles:
// questo preserva l'attribuzione storica in production_schedules.updated_by e in
// audit_logs.changed_by, che continuano a puntare a un profilo esistente.
//
// Disattivazione: revoca ogni riga di user_plant_access (l'utente non vede più
// nulla, applicato dalla RLS stessa), blocca il login lato Supabase Auth (ban),
// e marca profiles.is_active = false.
//
// Riattivazione: rimuove il ban e marca profiles.is_active = true. Gli accessi
// agli impianti NON vengono ripristinati automaticamente: vanno riassegnati
// dall'admin da "Gestisci permessi", per scelta esplicita e non per default.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ~100 anni: Supabase non ha un valore letterale "permanente", questo è
// l'equivalente pratico raccomandato dalla documentazione ufficiale.
const PERMANENT_BAN = '876000h';
const NO_BAN = 'none';

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

    // Client "per conto" di chi chiama: verifica identità e ruolo rispettando la RLS.
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
    const { user_id, active } = body || {};

    if (!user_id || typeof active !== 'boolean') {
      return jsonResponse({ error: 'Richiesta non valida: user_id e active (booleano) sono obbligatori.' }, 400);
    }

    if (user_id === caller.id && active === false) {
      return jsonResponse({ error: 'Non puoi disattivare il tuo stesso account.' }, 400);
    }

    // Da qui in poi operiamo con la service_role key: bypassa la RLS ed è l'unica
    // che permette di bannare/sbloccare un account in Supabase Auth.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (!active) {
      const { error: accessError } = await adminClient.from('user_plant_access').delete().eq('user_id', user_id);
      if (accessError) {
        return jsonResponse({ error: `Impossibile revocare gli accessi: ${accessError.message}` }, 400);
      }

      const { error: banError } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: PERMANENT_BAN
      });
      if (banError) {
        return jsonResponse({ error: `Impossibile bloccare l'accesso: ${banError.message}` }, 400);
      }

      const { error: profileUpdateError } = await adminClient
        .from('profiles')
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('id', user_id);
      if (profileUpdateError) {
        return jsonResponse({ error: `Impossibile aggiornare il profilo: ${profileUpdateError.message}` }, 400);
      }
    } else {
      const { error: unbanError } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: NO_BAN
      });
      if (unbanError) {
        return jsonResponse({ error: `Impossibile sbloccare l'accesso: ${unbanError.message}` }, 400);
      }

      const { error: profileUpdateError } = await adminClient
        .from('profiles')
        .update({ is_active: true, deactivated_at: null })
        .eq('id', user_id);
      if (profileUpdateError) {
        return jsonResponse({ error: `Impossibile aggiornare il profilo: ${profileUpdateError.message}` }, 400);
      }
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Errore interno.' }, 500);
  }
});
