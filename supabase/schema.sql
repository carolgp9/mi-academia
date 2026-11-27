create extension if not exists pgcrypto;
create table if not exists public.tests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null, source_name text, questions jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.results (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 test_id uuid references public.tests(id) on delete set null,
 test_title text not null, score numeric(4,1) not null default 0,
 correct integer not null default 0, total integer not null default 0,
 created_at timestamptz not null default now()
);
alter table public.tests enable row level security;
alter table public.results enable row level security;
create policy "Own tests" on public.tests for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Own results" on public.results for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
