
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS subcategory text;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE POLICY "sales cancel update"
ON public.sales
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
