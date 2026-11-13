-- Rangements : collection (vins / spiritueux / mixte) et nouveaux types (bar, vitrine, carton). Relançable.
alter table public.rangements add column if not exists profil text;

alter table public.rangements drop constraint if exists rangements_profil_check;
alter table public.rangements add constraint rangements_profil_check
  check (profil is null or profil in ('vin', 'spiritueux', 'mixte'));

alter table public.rangements drop constraint if exists rangements_type_check;
alter table public.rangements add constraint rangements_type_check
  check (type in ('placard', 'etagere', 'carton', 'casier', 'montrouge', 'bar', 'vitrine'));
