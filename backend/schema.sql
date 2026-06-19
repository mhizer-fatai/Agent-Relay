-- Enable UUID generation extension
create extension if not exists "uuid-ossp";

-- Create Profiles table to manage user profiles and auth status
create table if not exists public.profiles (
    id uuid default uuid_generate_v4() primary key,
    username text unique,
    email text unique,
    login_type text not null check (login_type in ('wallet', 'google')),
    wallet_address text unique,
    api_key text unique not null,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index user identifiers for profile lookups
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_wallet_address_idx on public.profiles(wallet_address);
create index if not exists profiles_api_key_idx on public.profiles(api_key);
create index if not exists profiles_username_idx on public.profiles(username);

-- Create Agents table to manage agent names and state mappings
create table if not exists public.agents (
    id uuid default uuid_generate_v4() primary key,
    name text unique not null,
    owner_id uuid references public.profiles(id) on delete cascade not null,
    current_blob_id text not null,
    parent_blob_id text,
    sui_object_id text,
    version text default '1.0.0' not null,
    importance_score integer default 5 not null,
    visibility text default 'pr' check (visibility in ('pb', 'pr')) not null,
    history text[] default '{}'::text[] not null,
    source_links text[] default '{}'::text[] not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index agent details for lookup efficiency
create index if not exists agents_name_idx on public.agents(name);
create index if not exists agents_owner_id_idx on public.agents(owner_id);

-- Create Marketplace Listings table for cognitive state listings
create table if not exists public.marketplace_listings (
    id text primary key,
    creator_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    encrypted_blob_id text not null,
    price_mist bigint not null,
    sui_listing_id text,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index creator relationship on marketplace listings
create index if not exists marketplace_listings_creator_id_idx on public.marketplace_listings(creator_id);

-- Create Purchases table to record buyer transactions and decryption keys
create table if not exists public.purchases (
    id uuid default uuid_generate_v4() primary key,
    buyer_id uuid references public.profiles(id) on delete cascade not null,
    listing_id text references public.marketplace_listings(id) on delete cascade not null,
    decryption_key text not null,
    sui_tx_digest text,
    purchased_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index buyer and listing keys on purchases
create index if not exists purchases_buyer_id_idx on public.purchases(buyer_id);
create index if not exists purchases_listing_id_idx on public.purchases(listing_id);

-- Create API Keys table to support API key management and rotation
create table if not exists public.api_keys (
    id uuid default uuid_generate_v4() primary key,
    owner_id uuid references public.profiles(id) on delete cascade not null,
    key text unique not null,
    label text,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index API keys and active statuses
create index if not exists api_keys_key_idx on public.api_keys(key);
create index if not exists api_keys_owner_id_idx on public.api_keys(owner_id);

-- Create CLI Sessions table to authorize pending login tokens
create table if not exists public.cli_sessions (
    cli_token text primary key,
    status text not null default 'pending',
    owner_id uuid references public.profiles(id) on delete set null,
    api_key text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Activity Log table to audit user actions
create table if not exists public.activity_log (
    id uuid default uuid_generate_v4() primary key,
    owner_id uuid references public.profiles(id) on delete cascade not null,
    action text not null,
    target_name text,
    metadata jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index activity logs by owner
create index if not exists activity_log_owner_id_idx on public.activity_log(owner_id);

-- Enable Row Level Security on all schema tables
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.purchases enable row level security;
alter table public.api_keys enable row level security;
alter table public.cli_sessions enable row level security;
alter table public.activity_log enable row level security;

-- Configure public access bypass policies for hackathon usage
create policy "Allow public access to profiles" on public.profiles for all using (true) with check (true);
create policy "Allow public access to agents" on public.agents for all using (true) with check (true);
create policy "Allow public access to marketplace_listings" on public.marketplace_listings for all using (true) with check (true);
create policy "Allow public access to purchases" on public.purchases for all using (true) with check (true);
create policy "Allow public access to api_keys" on public.api_keys for all using (true) with check (true);
create policy "Allow public access to cli_sessions" on public.cli_sessions for all using (true) with check (true);
create policy "Allow public access to activity_log" on public.activity_log for all using (true) with check (true);

