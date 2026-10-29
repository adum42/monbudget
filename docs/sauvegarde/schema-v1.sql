-- Schéma de la base monbudget AVANT la refonte multi-comptes (29/10/2026)
-- Permet de recréer la structure à l'identique. Les données sont copiées dans le schéma `sauvegarde` de Supabase.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  nom text not null,
  type text not null default 'les deux' check (type in ('entrée','sortie','les deux')),
  couleur text default '#378ADD',
  created_at timestamptz default now(),
  emoji text default '📁'
);

create table public.comptes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  nom text not null,
  type text not null check (type in ('livret','investissement')),
  banque text,
  couleur text default '#5B6EF5',
  created_at timestamptz default now()
);

create table public.soldes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  compte_id uuid not null references public.comptes(id),
  date date not null,
  montant numeric(12,2) not null,
  note text,
  created_at timestamptz default now(),
  unique (compte_id, date)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  description text not null,
  montant numeric(10,2) not null,
  type text not null check (type in ('entrée','sortie','mouvement')),
  categorie_id uuid references public.categories(id),
  date date not null,
  created_at timestamptz default now(),
  compte_id uuid references public.comptes(id),
  direction text check (direction in ('vers','depuis')),
  tricount text default 'non' check (tricount in ('non','oui','oui validé')),
  epingle boolean not null default false,
  note text
);

alter table public.categories   enable row level security;
alter table public.comptes      enable row level security;
alter table public.soldes       enable row level security;
alter table public.transactions enable row level security;

create policy users_categories   on public.categories   for all using (auth.uid() = user_id);
create policy users_comptes      on public.comptes      for all using (auth.uid() = user_id);
create policy users_soldes       on public.soldes       for all using (auth.uid() = user_id);
create policy users_transactions on public.transactions for all using (auth.uid() = user_id);
