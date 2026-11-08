-- Cave Revival — schéma initial (vin + spiritueux)
-- Principe : le téléphone (IndexedDB) est la référence ; Supabase sert de sauvegarde et de synchro.
-- Chaque ligne a un uuid généré côté app, un horodatage client (modifie_le, dernier écrit gagne),
-- une suppression logique (supprime) et un curseur serveur (sync_at) pour tirer les changements.

create or replace function public.touch_sync() returns trigger
language plpgsql as $$
begin
  new.sync_at := now();
  return new;
end $$;

create table public.rangements (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom         text not null,
  type        text not null check (type in ('placard', 'etagere', 'casier', 'montrouge')),
  lieu        text,
  lignes      smallint,
  colonnes    smallint,
  ble_id      text,
  modifie_le  timestamptz not null default now(),
  supprime    boolean not null default false,
  sync_at     timestamptz not null default now()
);

create table public.produits (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profil        text not null check (profil in ('vin', 'spiritueux')),
  nom           text not null,
  producteur    text,
  cuvee         text,
  millesime     smallint,
  style         text,          -- rouge, blanc, champagne, prosecco… / tourbe, malt, sherry, blend, rhum…
  pays          text,          -- code ISO ou région à drapeau (BZH, SC…)
  region        text,
  appellation   text,
  cepages       text,
  degre         numeric(4,1),
  age_ans       smallint,
  fut           text,
  note          numeric(2,1) check (note between 0 and 5),
  apogee_debut  smallint,
  apogee_fin    smallint,
  photo_path    text,          -- chemin dans le bucket « etiquettes » : <user_id>/<produit_id>.jpg
  commentaire   text,
  extra         jsonb not null default '{}',
  modifie_le    timestamptz not null default now(),
  supprime      boolean not null default false,
  sync_at       timestamptz not null default now()
);

create table public.bouteilles (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produit_id    uuid not null references public.produits (id) on delete cascade,
  rangement_id  uuid references public.rangements (id) on delete set null,
  emplacement   text,          -- ex. R3-E2
  numero        integer,       -- ID affiché dans le casier
  etat          text not null default 'stock' check (etat in ('stock', 'ouverte', 'bue', 'offerte')),
  niveau        smallint check (niveau between 0 and 100),
  entree_le     date,
  ouverte_le    date,
  sortie_le     date,
  prix          numeric(8,2),
  modifie_le    timestamptz not null default now(),
  supprime      boolean not null default false,
  sync_at       timestamptz not null default now()
);

create table public.mesures (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produit_id  uuid references public.produits (id) on delete set null,  -- null = verre non rattaché
  appareil    text not null default 'myoeno',
  mesure_le   timestamptz not null default now(),
  brut        jsonb not null,  -- trame complète : 6 uint16, état, batterie (conservée pour l'analyse spiritueux)
  puissance   smallint,
  tanins      smallint,
  vivacite    smallint,
  garde       smallint,
  evolution   smallint,
  modifie_le  timestamptz not null default now(),
  supprime    boolean not null default false,
  sync_at     timestamptz not null default now()
);

create table public.degustations (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  produit_id   uuid references public.produits (id) on delete cascade,
  mesure_id    uuid references public.mesures (id) on delete set null,
  le           date not null default current_date,
  note         numeric(2,1) check (note between 0 and 5),
  mots_cles    text[] not null default '{}',
  commentaire  text,
  aeration_h   numeric(3,1),
  modifie_le   timestamptz not null default now(),
  supprime     boolean not null default false,
  sync_at      timestamptz not null default now()
);

-- Même traitement pour toutes les tables : droits explicites (l'exposition automatique est désactivée),
-- RLS propriétaire, trigger de synchro, index de curseur.
do $$
declare t text;
begin
  foreach t in array array['rangements', 'produits', 'bouteilles', 'mesures', 'degustations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy proprietaire on public.%I for all to authenticated '
      'using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format(
      'create trigger %I before insert or update on public.%I '
      'for each row execute function public.touch_sync()', t || '_sync', t);
    execute format('create index %I on public.%I (user_id, sync_at)', t || '_sync_idx', t);
  end loop;
end $$;

-- Photos d'étiquettes : bucket privé, un dossier par utilisateur.
insert into storage.buckets (id, name, public)
values ('etiquettes', 'etiquettes', false)
on conflict (id) do nothing;

create policy etiquettes_proprietaire on storage.objects for all to authenticated
  using (bucket_id = 'etiquettes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'etiquettes' and (storage.foldername(name))[1] = auth.uid()::text);
