-- Force the public store contact/WhatsApp phone everywhere settings can read it.
-- Display format: +96655 740 4827
-- Dial/WhatsApp digits: 966557404827

INSERT INTO public.site_settings (id, whatsapp_number, store_phone)
VALUES (1, '+96655 740 4827', '+96655 740 4827')
ON CONFLICT (id) DO UPDATE
SET
  whatsapp_number = '+96655 740 4827',
  store_phone = '+96655 740 4827',
  updated_at = now();

INSERT INTO public.storefront_settings (id, footer_phone, footer_whatsapp)
VALUES (true, '+96655 740 4827', 'https://wa.me/966557404827')
ON CONFLICT (id) DO UPDATE
SET
  footer_phone = '+96655 740 4827',
  footer_whatsapp = 'https://wa.me/966557404827',
  updated_at = now();

