-- Focus NFe: campos fiscais em produtos e rastreio de NFC-e em vendas

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cfop text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icms_origem text DEFAULT '0';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icms_situacao_tributaria text;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'cupom';
ALTER TABLE public.sales ADD CONSTRAINT sales_tipo_documento_check
  CHECK (tipo_documento IN ('cupom', 'nfce'));
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_status text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_chave text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_numero text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_serie text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_status_sefaz text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_mensagem_sefaz text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_danfe_url text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_qrcode_url text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS nfce_xml_url text;
