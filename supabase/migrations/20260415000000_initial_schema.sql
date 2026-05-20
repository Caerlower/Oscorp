-- Oscorp MVP schema (run in Supabase SQL editor or via CLI)

create extension if not exists "pgcrypto";

-- Users (linked to Supabase auth when enabled)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_username text,
  chat_id bigint not null,
  onboarding_step text not null default 'start',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.x_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  handle text not null,
  display_name text,
  follower_count int default 0,
  last_analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, handle)
);

create table if not exists public.growth_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  x_account_id uuid references public.x_accounts(id) on delete set null,
  niche text not null,
  growth_goal text not null,
  tone text not null,
  posts_per_day int not null default 2,
  timezone text default 'UTC',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_registry (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  service_name text not null,
  base_url text not null,
  price_micro_usdc int not null,
  pay_to_address text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  provider_key text not null,
  service_name text not null,
  payment_tx text not null unique,
  amount_micro_usdc int not null,
  output_hash text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  growth_profile_id uuid references public.growth_profiles(id) on delete set null,
  category text not null,
  content text not null,
  reasoning text,
  status text not null default 'draft',
  intent_url text,
  provider_outputs jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  generated_post_id uuid not null references public.generated_posts(id) on delete cascade,
  scheduled_for timestamptz not null,
  sent_to_telegram boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  x_account_id uuid references public.x_accounts(id) on delete set null,
  engagement_delta_pct numeric(8,2),
  top_topics jsonb default '[]'::jsonb,
  snapshot jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.growth_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  report_type text not null default 'daily',
  summary text not null,
  metrics jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.content_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  memory_key text not null,
  memory_value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key)
);

alter table public.users enable row level security;
alter table public.telegram_accounts enable row level security;
alter table public.x_accounts enable row level security;
alter table public.growth_profiles enable row level security;
alter table public.generated_posts enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.analytics_snapshots enable row level security;
alter table public.growth_reports enable row level security;
alter table public.content_memory enable row level security;
