-- Aggiunge lo stato attivo/disattivo ai profili utente.
--
-- Serve a "disattivare" un utente (es. un fornitore che ha concluso il
-- rapporto) SENZA mai cancellarne la riga in profiles: questo evita di
-- rompere il vincolo di integrità referenziale con production_schedules
-- (updated_by) e audit_logs (changed_by), e soprattutto preserva per
-- sempre l'attribuzione storica delle sue azioni passate.
--
-- La disattivazione vera e propria (revoca accessi + blocco login) è
-- gestita dalla Edge Function admin-set-user-active, non da questa
-- migrazione: qui viene solo predisposto lo schema.

alter table profiles
  add column if not exists is_active boolean not null default true;

alter table profiles
  add column if not exists deactivated_at timestamptz;

comment on column profiles.is_active is
  'false = utente disattivato: accessi revocati e login bloccato, ma storico preservato.';
comment on column profiles.deactivated_at is
  'Data/ora dell''ultima disattivazione, per riferimento. NULL se mai disattivato o riattivato.';
