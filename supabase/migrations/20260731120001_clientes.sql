CREATE TABLE IF NOT EXISTS public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  email text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage clientes"
  ON public.clientes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
