-- =====================================================================
-- The Dorms Lubumbashi — base de données Supabase
-- À coller une seule fois dans Supabase > SQL Editor > New query > Run.
-- Le script peut être relancé sans danger (il ne supprime aucune donnée).
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------- Logement : maisons > chambres > lits ----------
-- Un « lit » est l'unité réservable. Une chambre individuelle louée entière = une chambre avec UN seul « lit »
-- (nommé par ex. « Chambre entière »). Ainsi dortoirs et chambres privées utilisent le même modèle.
create table if not exists maisons (
  id bigint generated always as identity primary key,
  nom text not null,
  actif boolean not null default true,          -- false = « bientôt », pas encore réservable
  ordre int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tarifs (
  type text primary key check (type ~ '^[a-z_]+$'),   -- 'dortoir', 'double', 'individuelle'…
  mois numeric(10,2) not null check (mois >= 0),           -- séjour étudiant de 3 mois ou plus
  mois_court numeric(10,2) check (mois_court >= 0),       -- séjour étudiant de moins de 3 mois (null = même prix que mois)
  trimestre numeric(10,2) not null check (trimestre >= 0),
  nuit numeric(10,2) check (nuit >= 0)               -- null = pas de location à la nuit
);

create table if not exists chambres (
  id bigint generated always as identity primary key,
  maison_id bigint not null references maisons(id) on delete cascade,
  nom text not null,
  type text not null references tarifs(type),
  actif boolean not null default true,
  ordre int not null default 0
);

create table if not exists lits (
  id bigint generated always as identity primary key,
  chambre_id bigint not null references chambres(id) on delete cascade,
  nom text not null,
  actif boolean not null default true,
  ordre int not null default 0
);

-- ---------- Réservations ----------
create table if not exists reservations (
  id bigint generated always as identity primary key,
  client text not null check (client in ('etudiant', 'voyageur')),
  formule text not null references tarifs(type),
  lit_id bigint references lits(id) on delete set null,
  debut date not null,
  fin date not null,                                   -- jour de départ (non compris)
  nom text not null check (length(nom) between 1 and 120),
  telephone text not null check (length(telephone) between 6 and 30),
  email text check (email is null or length(email) <= 120),
  universite text check (universite is null or length(universite) <= 120),
  message text check (message is null or length(message) <= 1000),
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'approuvee', 'confirmee', 'refusee', 'annulee', 'terminee', 'conflit')),
  source text not null default 'site' check (source in ('site', 'admin', 'airbnb')),
  source_ical_id bigint,
  uid_externe text,
  montant numeric(10,2),
  notes text,
  notifie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fin > debut),
  -- ANTI-DOUBLE RÉSERVATION : deux séjours approuvés/confirmés ne peuvent pas se chevaucher sur le même lit.
  constraint pas_de_double_reservation exclude using gist (
    lit_id with =, daterange(debut, fin, '[)') with &&
  ) where (statut in ('approuvee', 'confirmee') and lit_id is not null)
);
create unique index if not exists reservations_uid_ical on reservations (source_ical_id, uid_externe) where uid_externe is not null;
create index if not exists reservations_dates on reservations (debut, fin);
create index if not exists reservations_statut on reservations (statut);

create table if not exists paiements (
  id bigint generated always as identity primary key,
  reservation_id bigint references reservations(id) on delete set null,
  montant numeric(10,2) not null check (montant > 0),
  methode text not null check (methode in ('especes', 'mpesa', 'orange_money', 'airtel_money', 'autre')),
  reference text,
  date_paiement date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists paiements_date on paiements (date_paiement);

-- ---------- Airbnb (iCal) ----------
create table if not exists sources_ical (
  id bigint generated always as identity primary key,
  nom text not null default 'Airbnb',
  lit_id bigint not null references lits(id) on delete cascade,  -- lit bloqué par cette annonce
  url_import text,                                               -- lien iCal fourni par Airbnb
  jeton_export uuid not null default gen_random_uuid(),           -- partie secrète du lien à donner à Airbnb
  derniere_synchro timestamptz,
  dernier_resultat text
);
do $$ begin
  alter table reservations add constraint reservations_source_ical_fk foreign key (source_ical_id) references sources_ical(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- ---------- Réglages & administrateurs ----------
create table if not exists reglages (cle text primary key, valeur text);
create table if not exists admins (user_id uuid primary key references auth.users(id) on delete cascade);

create or replace function est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function maj_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists reservations_updated on reservations;
create trigger reservations_updated before update on reservations for each row execute function maj_updated_at();

-- ---------- Sécurité : Row Level Security ----------
-- Le public (clé « anon ») n'a AUCUN accès direct aux tables : il passe seulement par les 3 fonctions ci-dessous,
-- qui ne renvoient aucune donnée personnelle. Seuls les administrateurs connectés lisent/écrivent les tables.
do $$ declare t text; begin
  foreach t in array array['maisons','tarifs','chambres','lits','reservations','paiements','sources_ical','reglages','admins'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists admin_tout on %I', t);
    execute format('create policy admin_tout on %I for all to authenticated using (est_admin()) with check (est_admin())', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- Droits explicites (le projet n'expose pas automatiquement les nouvelles tables à l'API) :
-- les administrateurs connectés (filtrés par RLS ci-dessus) et les fonctions serveur. Le public : rien.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on maisons, tarifs, chambres, lits, reservations, paiements, sources_ical, reglages, admins to authenticated;
grant all on maisons, tarifs, chambres, lits, reservations, paiements, sources_ical, reglages, admins to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Libellé d'un lit : « Chambre A · Lit 1 »
create or replace function libelle_lit(p_lit bigint) returns text
language sql stable security definer set search_path = public as $$
  select c.nom || ' · ' || l.nom from lits l join chambres c on c.id = l.chambre_id where l.id = p_lit;
$$;

-- Lits réservables (maison, chambre et lit actifs)
create or replace view lits_reservables with (security_invoker = true) as
  select l.id, c.nom || ' · ' || l.nom as libelle, c.type, m.ordre as o1, c.ordre as o2, l.ordre as o3
  from lits l join chambres c on c.id = l.chambre_id join maisons m on m.id = c.maison_id
  where l.actif and c.actif and m.actif;

revoke all on lits_reservables from anon;

-- 1) Public : lits libres sur toute une période, pour une formule donnée
create or replace function lits_libres(p_debut date, p_fin date, p_formule text default 'dortoir')
returns table (id bigint, libelle text)
language sql stable security definer set search_path = public as $$
  select lr.id, lr.libelle from lits_reservables lr
  where lr.type = p_formule and p_fin > p_debut and p_fin - p_debut <= 400
    and not exists (
      select 1 from reservations r
      where r.lit_id = lr.id and r.statut in ('approuvee', 'confirmee', 'conflit')
        and daterange(r.debut, r.fin, '[)') && daterange(p_debut, p_fin, '[)'))
  order by lr.o1, lr.o2, lr.o3, lr.id;
$$;

-- 2) Public : calendrier des occupations (aucun nom, aucun téléphone)
create or replace function calendrier_public(p_debut date, p_fin date)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'lits', coalesce((select json_agg(json_build_object('id', lr.id, 'libelle', lr.libelle) order by lr.o1, lr.o2, lr.o3, lr.id) from lits_reservables lr), '[]'),
    'occupations', coalesce((select json_agg(json_build_object('lit_id', r.lit_id, 'debut', r.debut, 'fin', r.fin))
       from reservations r
       where r.lit_id is not null and r.statut in ('approuvee', 'confirmee', 'conflit')
         and p_fin - p_debut <= 400 and r.debut < p_fin and r.fin > p_debut), '[]'));
$$;

-- 3) Public : envoyer une demande de réservation (statut « en_attente »)
create or replace function demander_reservation(
  p_client text, p_formule text, p_debut date, p_fin date, p_lit bigint,
  p_nom text, p_telephone text, p_email text, p_universite text, p_message text, p_langue text default 'fr')
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  t tarifs; v_id bigint; v_montant numeric; v_mois int;
begin
  if p_client not in ('etudiant', 'voyageur') then raise exception 'CLIENT_INVALIDE'; end if;
  select * into t from tarifs where type = p_formule;
  if not found then raise exception 'FORMULE_INVALIDE'; end if;
  if p_debut is null or p_fin is null or p_fin <= p_debut or p_debut < current_date - 1 or p_fin - p_debut > 400 then
    raise exception 'DATES_INVALIDES';
  end if;
  if coalesce(trim(p_nom), '') = '' or length(regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g')) < 8 then
    raise exception 'CHAMPS_MANQUANTS';
  end if;
  -- anti-abus : tailles maximales (le formulaire limite déjà à 120 / 1000 caractères)
  if length(p_nom) > 150 or length(p_telephone) > 40 or length(coalesce(p_email, '')) > 200
     or length(coalesce(p_universite, '')) > 200 or length(coalesce(p_message, '')) > 2000 then
    raise exception 'CHAMP_TROP_LONG';
  end if;
  -- anti-abus : 3 demandes maximum par numéro (chiffres seuls) et par heure…
  if (select count(*) from reservations where source = 'site' and created_at > now() - interval '1 hour'
        and regexp_replace(telephone, '\D', '', 'g') = regexp_replace(p_telephone, '\D', '', 'g')) >= 3 then
    raise exception 'TROP_DE_DEMANDES';
  end if;
  -- … et 20 demandes maximum par heure pour tout le site (protège la base et le quota d'e-mails)
  if (select count(*) from reservations where source = 'site' and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'TROP_DE_DEMANDES';
  end if;
  if p_lit is not null then
    if not exists (select 1 from lits_reservables where id = p_lit and type = p_formule) then raise exception 'LIT_INVALIDE'; end if;
    if exists (select 1 from reservations r where r.lit_id = p_lit and r.statut in ('approuvee', 'confirmee', 'conflit')
               and daterange(r.debut, r.fin, '[)') && daterange(p_debut, p_fin, '[)')) then
      raise exception 'LIT_PRIS';
    end if;
  end if;
  if p_client = 'etudiant' then
    v_mois := greatest(1, (extract(year from age(p_fin, p_debut)) * 12 + extract(month from age(p_fin, p_debut)))::int);
    v_montant := v_mois * case when v_mois < 3 then coalesce(t.mois_court, t.mois) else t.mois end;
  else
    v_montant := (p_fin - p_debut) * coalesce(t.nuit, t.mois);
  end if;
  insert into reservations (client, formule, lit_id, debut, fin, nom, telephone, email, universite, message, langue, montant)
  values (p_client, p_formule, p_lit, p_debut, p_fin, trim(p_nom), trim(p_telephone),
          nullif(trim(p_email), ''), nullif(trim(p_universite), ''), nullif(trim(p_message), ''),
          case when p_langue = 'en' then 'en' else 'fr' end, v_montant)
  returning id into v_id;
  return json_build_object('ref', 'DL-' || lpad(v_id::text, 4, '0'));
end $$;

revoke all on function lits_libres(date, date, text), calendrier_public(date, date),
  demander_reservation(text, text, date, date, bigint, text, text, text, text, text, text) from public;
grant execute on function lits_libres(date, date, text), calendrier_public(date, date),
  demander_reservation(text, text, date, date, bigint, text, text, text, text, text, text) to anon, authenticated;
revoke all on function libelle_lit(bigint) from public, anon;
grant execute on function libelle_lit(bigint) to authenticated, service_role;
-- est_admin() sert aux règles RLS des administrateurs connectés : inutile pour le public.
revoke all on function est_admin() from public, anon;
grant execute on function est_admin() to authenticated, service_role;

-- ---------- Notification e-mail à chaque nouvelle demande ----------
-- Appelle la fonction Edge « notifier » (qui envoie l'e-mail via Resend).
create or replace function appeler_notifier() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare u text;
begin
  -- La fonction « notifier » est déployée sans vérification de clé : elle n'envoie que les demandes
  -- pas encore signalées, et seulement à votre adresse. Aucun secret n'est donc stocké ici.
  select valeur into u from reglages where cle = 'url_projet';
  if u is not null then
    perform net.http_post(url := u || '/functions/v1/notifier',
      headers := jsonb_build_object('Content-Type', 'application/json'), body := '{}'::jsonb);
  end if;
  return new;
end $$;
-- Fonction de déclencheur uniquement : personne ne doit pouvoir l'appeler par l'API.
revoke all on function appeler_notifier() from public, anon, authenticated;
drop trigger if exists reservations_notifier on reservations;
create trigger reservations_notifier after insert on reservations
  for each row when (new.source = 'site') execute function appeler_notifier();

-- ---------- Tâches automatiques (pg_cron) ----------
-- Clé secrète de la synchronisation Airbnb : générée ici, elle ne quitte jamais la base
-- (la fonction « ical » la relit avec la clé serveur). Sans elle, seul un administrateur connecté peut lancer la synchro.
insert into reglages (cle, valeur)
values ('cle_sync', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (cle) do nothing;

-- Synchronisation Airbnb toutes les 30 minutes.
do $$ begin perform cron.unschedule('dorms-ical-sync'); exception when others then null; end $$;
select cron.schedule('dorms-ical-sync', '*/30 * * * *', $c$
  select net.http_post(
    url := (select valeur from public.reglages where cle = 'url_projet') || '/functions/v1/ical?sync=1',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-cle-sync', (select valeur from public.reglages where cle = 'cle_sync')),
    body := '{}'::jsonb)
  where exists (select 1 from public.sources_ical where url_import is not null);
$c$);

-- Adresse du projet (utilisée par le déclencheur e-mail). Remplacez si vous recréez le projet.
insert into reglages (cle, valeur) values ('url_projet', 'https://xisadtwihzbkswnwssfd.supabase.co')
on conflict (cle) do update set valeur = excluded.valeur;

-- ---------- Données de départ (seulement si la base est vide) ----------
insert into tarifs (type, mois, mois_court, trimestre, nuit) values
  ('dortoir', 80, 100, 240, 15), ('double', 90, null, 270, null), ('individuelle', 120, null, 360, null)
on conflict (type) do nothing;

insert into reglages (cle, valeur) values
  ('instructions_paiement', 'Paiement : en espèces sur place, ou par Mobile Money (M-Pesa, Orange Money, Airtel Money) au +243 863 472 047. Merci d''envoyer la référence de la transaction sur WhatsApp.'),
  ('instructions_paiement_en', 'Payment: cash on site, or Mobile Money (M-Pesa, Orange Money, Airtel Money) to +243 863 472 047. Please send the transaction reference on WhatsApp.')
on conflict (cle) do nothing;

do $$
declare m1 bigint; m2 bigint; c bigint; i int;
begin
  if exists (select 1 from maisons) then return; end if;
  insert into maisons (nom, actif, ordre) values ('Maison 1', true, 1) returning id into m1;
  insert into maisons (nom, actif, ordre) values ('Maison 2 (nouvelle)', false, 2) returning id into m2;
  insert into chambres (maison_id, nom, type, ordre) values (m1, 'Chambre A', 'dortoir', 1) returning id into c;
  for i in 1..4 loop insert into lits (chambre_id, nom, ordre) values (c, 'Lit ' || i, i); end loop;
  insert into chambres (maison_id, nom, type, ordre) values (m1, 'Chambre B', 'dortoir', 2) returning id into c;
  for i in 1..4 loop insert into lits (chambre_id, nom, ordre) values (c, 'Lit ' || i, i); end loop;
  for i in 1..2 loop
    insert into chambres (maison_id, nom, type, ordre) values (m2, 'Double ' || i, 'double', i) returning id into c;
    insert into lits (chambre_id, nom, ordre) values (c, 'Lit 1', 1), (c, 'Lit 2', 2);
  end loop;
  for i in 1..4 loop
    insert into chambres (maison_id, nom, type, ordre) values (m2, 'Individuelle ' || i, 'individuelle', 2 + i) returning id into c;
    insert into lits (chambre_id, nom, ordre) values (c, 'Chambre entière', 1);
  end loop;
end $$;
