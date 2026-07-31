CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  email text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage fornecedores"
  ON public.fornecedores
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
