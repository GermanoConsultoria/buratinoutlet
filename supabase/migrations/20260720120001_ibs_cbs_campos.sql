-- Campos IBS/CBS (Reforma Tributária) em produtos para emissão de NFC-e
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ibs_cbs_situacao_tributaria text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ibs_cbs_classificacao_tributaria text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cbs_aliquota numeric;
-- ibs_aliquota_total guarda o valor bruto da planilha (coluna Y) até confirmação da contadora
-- sobre a divisão entre ibs_uf_aliquota e ibs_mun_aliquota. Essas duas colunas NÃO existem
-- ainda — aguardando confirmação antes de criá-las.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ibs_aliquota_total numeric;
