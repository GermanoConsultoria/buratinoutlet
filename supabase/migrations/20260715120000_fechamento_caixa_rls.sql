-- Garante que RLS existe e adiciona policies para fechamento_caixa
-- A tabela foi criada manualmente sem policies — isso bloqueava SELECT e INSERT

ALTER TABLE public.fechamento_caixa ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fechamento_caixa' AND policyname = 'fechamento_caixa read'
  ) THEN
    EXECUTE 'CREATE POLICY "fechamento_caixa read" ON public.fechamento_caixa FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fechamento_caixa' AND policyname = 'fechamento_caixa insert'
  ) THEN
    EXECUTE 'CREATE POLICY "fechamento_caixa insert" ON public.fechamento_caixa FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fechamento_caixa' AND policyname = 'fechamento_caixa update'
  ) THEN
    EXECUTE 'CREATE POLICY "fechamento_caixa update" ON public.fechamento_caixa FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- Garante unicidade: cada sessão de caixa tem no máximo um fechamento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fechamento_caixa_caixa_id_unique'
  ) THEN
    ALTER TABLE public.fechamento_caixa
      ADD CONSTRAINT fechamento_caixa_caixa_id_unique UNIQUE (caixa_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.fechamento_caixa TO authenticated;
GRANT ALL ON public.fechamento_caixa TO service_role;
