import crypto from 'node:crypto'
import axios from 'axios'
import bunyan from 'bunyan'
import {
  DecodePaymentRequestResult,
  GetInvoiceResult,
  authenticatedLndGrpc,
  cancelHodlInvoice,
  createHodlInvoice,
  decodePaymentRequest,
  getInvoice,
  pay,
  settleHodlInvoice,
  subscribeToInvoice
} from 'lightning'
import { io } from './server'
import { env } from './env'
const log = bunyan.createLogger({ name: 'lnd' })

const { lnd } = authenticatedLndGrpc({
  cert: env.LND_CERT,
  macaroon: env.LND_MACAROON,
  socket: env.LND_HOST,
})

export async function validateInvoice(request: string) {
  try {
    const invoice = await decodePaymentRequest({ lnd, request })

    const now = Math.floor(new Date().getTime() / 1000)
    const expiresAt = new Date(invoice.expires_at).getTime() / 1000

    if (expiresAt > now) {
      return {
        isValid: true,
        invoice,
      }
    }

    log.warn({ invoice }, 'Invoice expired')
  } catch (error) {
    log.error({ error }, 'Error decoding invoice')
  }

  return {
    isValid: false,
    invoice: null,
  }
}

export async function wrapInvoice(invoice: DecodePaymentRequestResult, request: string, webhook?: string) {
  const { request: hodlRequest } = await createHodlInvoice({
    lnd,
    tokens: invoice.tokens,
    id: invoice.id,
    expires_at: invoice.expires_at,
  })

  const sub = subscribeToInvoice({ lnd, id: invoice.id })

  sub.on('invoice_updated', async (hodlInvoice: GetInvoiceResult) => {
    if (hodlInvoice.is_canceled) {
      sub.removeAllListeners()

      if (webhook) {
        axios.post(webhook, {
          id: hodlInvoice.id,
          settled: false,
          preimage: null,
        })
      }

      return
    }

    if (hodlInvoice.is_held) {
      try {
        const { secret } = await pay({ lnd, request })
        await settleHodlInvoice({ lnd, secret })

        const computedId = crypto
            .createHash('sha256')
            .update(Buffer.from(secret, 'hex'))
            .digest('hex')

        const log = bunyan.createLogger({ name: 'lnd' })
        log.info({ id: hodlInvoice.id }, 'Invoice settled')

        const data = {
          id: hodlInvoice.id,
          settled: computedId === hodlInvoice.id,
          preimage: secret,
        }

        if (webhook) {
          axios.post(webhook, data)
        }

        io.emit(hodlInvoice.id, data)
      } catch (error) {
        log.error({ error }, 'Error paying invoice')
        await cancelHodlInvoice({ lnd, id: hodlInvoice.id })
        if (webhook) {
          axios.post(webhook, {
            id: hodlInvoice.id,
            settled: false,
            preimage: null,
          })
        }
      }

      sub.removeAllListeners()
    }
  })

  return { request: hodlRequest }
}

export async function isInvoicePaid(id: string) {
  const invoice = await getInvoice({ lnd, id })

  return {
    settled: invoice.is_confirmed,
    preimage: invoice.is_confirmed ? invoice.secret : null,
  }
}
