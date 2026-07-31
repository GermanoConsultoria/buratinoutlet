-- Salva corpo bruto da resposta de erro da Focus NFe para debug em produção
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_erro_bruto jsonb;
