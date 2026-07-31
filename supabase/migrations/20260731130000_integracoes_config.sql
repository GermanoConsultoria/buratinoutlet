-- Tabela de configuração de integrações externas
-- Acessível apenas via service role (sem RLS policies públicas)
create table if not exists integracoes_config (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null unique,   -- ex: 'banco_inter'
  config      jsonb       not null default '{}',
  ativo       boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table integracoes_config enable row level security;

-- Nenhuma policy pública — acesso somente via service_role key nas server functions
