-- Oscorp x402 payment schema (safe to re-run in Supabase SQL editor)

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  payment_mode text not null default 'per_action' check (payment_mode in ('per_action', 'agent_wallet', 'batch')),
  batch_budget_usdc numeric not null default 0,
  batch_spent_usdc numeric not null default 0,
  agent_wallet_address text,
  agent_wallet_usdc_balance numeric not null default 0,
  onboarding_completed boolean not null default false,
  product_site text,
  created_at timestamptz not null default now()
);

-- Agent outputs (tweets, posts, etc.) — source of truth for feed + completion state.
create table if not exists public.agent_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  agent text not null check (
    agent in ('twitter', 'linkedin', 'articles', 'hackernews', 'reddit')
  ),
  slot_index int not null default 0,
  content jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'posted')),
  deliverable_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create unique index if not exists agent_deliverables_user_agent_date_slot
  on public.agent_deliverables (user_id, agent, deliverable_date, slot_index);

create index if not exists agent_deliverables_user_agent_date_status_idx
  on public.agent_deliverables (user_id, agent, deliverable_date, status);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  agent text not null check (
    agent in (
      'reddit', 'twitter', 'linkedin', 'articles', 'hackernews',
      'brand_voice', 'competitors'
    )
  ),
  amount_usdc numeric not null,
  tx_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  payment_mode text not null check (
    payment_mode in ('per_action', 'agent_wallet', 'batch', 'x402_per_action', 'x402_batch')
  ),
  from_address text,
  to_address text,
  agent_wallet_address text,
  created_at timestamptz not null default now()
);

create unique index if not exists transactions_tx_hash_unique
  on public.transactions (tx_hash)
  where tx_hash not like 'batch-%';

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

-- Migrations for existing projects (safe to re-run):
-- IMPORTANT: drop old payment_mode constraints BEFORE updating rows to 'agent_wallet'.
alter table public.users drop constraint if exists users_payment_mode_check;
alter table public.transactions drop constraint if exists transactions_payment_mode_check;

alter table public.users add column if not exists product_site text;
alter table public.users add column if not exists agent_wallet_address text;
alter table public.users add column if not exists agent_wallet_usdc_balance numeric not null default 0;
alter table public.transactions add column if not exists from_address text;
alter table public.transactions add column if not exists to_address text;
alter table public.transactions add column if not exists agent_wallet_address text;

update public.users set payment_mode = 'agent_wallet' where payment_mode = 'batch';
update public.transactions set payment_mode = 'agent_wallet' where payment_mode = 'batch';

-- Remove legacy fake batch deductions (not real on-chain txs).
delete from public.transactions where tx_hash like 'batch-%';

alter table public.users add constraint users_payment_mode_check
  check (payment_mode in ('per_action', 'agent_wallet', 'batch'));

alter table public.transactions add constraint transactions_payment_mode_check
  check (payment_mode in ('per_action', 'agent_wallet', 'batch', 'x402_per_action', 'x402_batch'));

alter table public.users enable row level security;
alter table public.transactions enable row level security;
alter table public.agent_deliverables enable row level security;

-- Service role bypasses RLS; recreate policies so this script is idempotent.
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (true);

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (true);

drop policy if exists "agent_deliverables_select_own" on public.agent_deliverables;
create policy "agent_deliverables_select_own" on public.agent_deliverables
  for select using (true);

-- Per-user workspace: site analysis, company profile, doc edits, CMO chat.
create table if not exists public.user_workspaces (
  user_id uuid not null references public.users(id) on delete cascade,
  site_url text not null,
  analysis jsonb,
  company_profile jsonb not null default '{}'::jsonb,
  edited_documents jsonb not null default '{}'::jsonb,
  chat_active_messages jsonb not null default '[]'::jsonb,
  chat_archived_sessions jsonb not null default '[]'::jsonb,
  analysis_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, site_url)
);

create index if not exists user_workspaces_user_updated_idx
  on public.user_workspaces (user_id, updated_at desc);

alter table public.user_workspaces enable row level security;

drop policy if exists "user_workspaces_select_own" on public.user_workspaces;
create policy "user_workspaces_select_own" on public.user_workspaces
  for select using (true);
