import { createNotify, createClient } from '@betternotify/core'
import { emailChannel } from '@betternotify/email'
import { smtpTransport } from '@betternotify/smtp'
import { z } from 'zod'

const FROM = process.env.EMAIL_FROM || 'ZRNO Coffee <hello@zrno.cz>'

const email = emailChannel({ defaults: { from: FROM } })
const rpc = createNotify({ channels: { email } })

const wrap = (title: string, body: string) => `
<div style="background:#0b0908;color:#f4ece0;font-family:Inter,Arial,sans-serif;padding:40px">
  <div style="max-width:560px;margin:0 auto">
    <div style="font-family:Anton,Arial,sans-serif;font-size:34px;letter-spacing:1px;color:#f4ece0">ZRNO</div>
    <div style="height:2px;background:#e0913d;width:48px;margin:14px 0 28px"></div>
    <h1 style="font-size:22px;margin:0 0 16px;color:#f4ece0">${title}</h1>
    ${body}
    <p style="color:#a1907e;font-size:12px;margin-top:36px">ZRNO Coffee · Kubelíkova 22, Žižkov, Praha 3</p>
  </div>
</div>`

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ email: z.string() }))
    .subject(() => 'Welcome to ZRNO ☕')
    .template({
      render: async () => ({
        html: wrap(
          'You’re on the list.',
          `<p style="color:#f4ece0;line-height:1.6">Thanks for subscribing. We’ll send new single-origin drops, brewing notes and events at the bar — nothing else.</p>`,
        ),
      }),
    }),
  orderConfirmation: rpc
    .email()
    .input(
      z.object({
        orderId: z.string(),
        total: z.number(),
        items: z.array(z.object({ name: z.string(), qty: z.number(), price: z.number() })),
      }),
    )
    .subject(({ input }) => `Your ZRNO order #${input.orderId.slice(0, 8)}`)
    .template({
      render: async ({ input }) => {
        const rows = input.items
          .map(
            (i) =>
              `<tr><td style="padding:6px 0;color:#f4ece0">${i.qty}× ${i.name}</td><td style="padding:6px 0;text-align:right;color:#a1907e">${i.price * i.qty} Kč</td></tr>`,
          )
          .join('')
        return {
          html: wrap(
            'Order confirmed.',
            `<p style="color:#f4ece0;line-height:1.6">We’re on it. Here’s your order:</p>
             <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
               <tr><td style="padding:12px 0 0;border-top:1px solid #6b5d50;color:#f4ece0;font-weight:700">Total</td>
               <td style="padding:12px 0 0;border-top:1px solid #6b5d50;text-align:right;color:#e0913d;font-weight:700">${input.total} Kč</td></tr>
             </table>`,
          ),
        }
      },
    }),
})

// Transport selection — SMTP → Mailpit today. To switch to Resend later:
//   import { resendTransport } from '@betternotify/resend'
//   return resendTransport({ apiKey: process.env.RESEND_API_KEY! })
function transport() {
  return smtpTransport({
    host: process.env.SMTP_HOST || 'mailpit',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: false,
  })
}

const client = createClient({
  catalog,
  transportsByChannel: { email: transport() },
})

export async function sendWelcome(to: string): Promise<void> {
  try {
    await client.welcome.send({ to, input: { email: to } })
  } catch (e) {
    console.error('[email] welcome failed:', e)
  }
}

export async function sendOrderConfirmation(
  to: string,
  input: { orderId: string; total: number; items: { name: string; qty: number; price: number }[] },
): Promise<void> {
  try {
    await client.orderConfirmation.send({ to, input })
  } catch (e) {
    console.error('[email] order confirmation failed:', e)
  }
}
