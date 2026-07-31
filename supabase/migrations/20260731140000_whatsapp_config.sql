-- Insere (ou ignora se já existir) a config inicial do WhatsApp
INSERT INTO public.integracoes_config (nome, config, ativo)
VALUES (
  'whatsapp',
  '{
    "provedor": "cloud_api",
    "phone_number_id": "",
    "access_token": "",
    "numero_whatsapp": "",
    "servicos": {
      "comprovante_cupom": true,
      "comprovante_nfce": true,
      "alertas_internos": false
    }
  }',
  false
)
ON CONFLICT (nome) DO NOTHING;
