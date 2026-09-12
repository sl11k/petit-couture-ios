import * as React from 'react'
import { Img, Section } from '@react-email/components'

export const EMAIL_BRAND_NAME = 'Le Petit Paradis'
export const EMAIL_SENDER_DOMAIN = 'notify.lppme.com'
export const EMAIL_FROM_DOMAIN = 'lppme.com'
export const EMAIL_WORDMARK_URL =
  'https://lppme.com/__l5e/assets-v1/6a88c54f-9e9d-47c5-a96e-527f898808a8/lpp-logo-transparent.png'

export function EmailBrandHeader() {
  return (
    <Section className="email-logo-shell" style={logoShell}>
      <Img
        className="email-wordmark"
        src={EMAIL_WORDMARK_URL}
        width="320"
        alt={EMAIL_BRAND_NAME}
        style={wordmark}
      />
    </Section>
  )
}

export const emailBrandDarkModeCss = `
  .email-logo-shell { background-color: #FFFFFF !important; }
  .email-wordmark { background-color: #FFFFFF !important; border-radius: 0 !important; }
  @media (prefers-color-scheme: dark) {
    .email-logo-shell { background-color: #FFFFFF !important; }
    .email-wordmark { background-color: #FFFFFF !important; }
  }
  [data-ogsc] .email-logo-shell, [data-ogsb] .email-logo-shell { background-color: #FFFFFF !important; }
  [data-ogsc] .email-wordmark, [data-ogsb] .email-wordmark { background-color: #FFFFFF !important; }
`

export function brandedEmailHeaderHtml(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;background-color:#FFFFFF!important;"><tr><td align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF!important;padding:24px 24px 22px;"><img src="${EMAIL_WORDMARK_URL}" alt="${EMAIL_BRAND_NAME}" width="320" style="display:block;width:100%;max-width:320px;height:auto;max-height:96px;margin:0 auto;border:0;border-radius:0;outline:none;text-decoration:none;object-fit:contain;background-color:#FFFFFF!important;" /></td></tr></table>`
}

export function wrapBrandedEmailHtml(content: string): string {
  const header = brandedEmailHeaderHtml()
  if (/<body\b[^>]*>/i.test(content)) {
    return content.replace(/<body\b[^>]*>/i, (bodyTag) => `${bodyTag}${header}`)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>.email-logo-shell,.email-wordmark{background-color:#FFFFFF!important}.email-wordmark{border-radius:0!important}@media(prefers-color-scheme:dark){.email-logo-shell,.email-wordmark{background-color:#FFFFFF!important}}[data-ogsc] .email-logo-shell,[data-ogsb] .email-logo-shell,[data-ogsc] .email-wordmark,[data-ogsb] .email-wordmark{background-color:#FFFFFF!important}</style></head><body style="margin:0;padding:0;background-color:#FFFFFF;">${header}${content}</body></html>`
}

const logoShell = {
  backgroundColor: '#FFFFFF',
  padding: '24px 20px 22px',
  textAlign: 'center' as const,
  width: '100%',
}

const wordmark = {
  display: 'block',
  width: '100%',
  maxWidth: '320px',
  height: 'auto',
  maxHeight: '96px',
  margin: '0 auto',
  objectFit: 'contain' as const,
  backgroundColor: '#FFFFFF',
  border: '0',
  borderRadius: '0',
  outline: 'none',
  textDecoration: 'none',
}