-- Classifica produtos sem categoria como "Sem Categoria"
UPDATE public.products
SET category = 'Sem Categoria'
WHERE category IS NULL OR category = '';
