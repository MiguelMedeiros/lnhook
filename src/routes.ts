import express from 'express'
import { z } from 'zod'
import { isInvoicePaid, validateInvoice, wrapInvoice } from './lnd'
const router = express.Router()
const bunyan = require('bunyan')
import crypto from 'node:crypto'

router.post('/wrap', async (req, res) => {
  const requestSchema = z.object({
    invoice: z.string().min(1),
    webhook: z.string().url().optional(),
  })

  const parsedRequest = requestSchema.safeParse(req.body)

  if (!parsedRequest.success) {
    res.status(400).json({ error: parsedRequest.error })
    return
  }

  const { invoice, isValid } = await validateInvoice(parsedRequest.data.invoice)

  if (!isValid || !invoice) {
    res.status(400).json({ error: 'Invalid invoice' })
    return
  }

  try {
    const wrappedInvoice = await wrapInvoice(invoice, parsedRequest.data.invoice, parsedRequest.data.webhook)

    res.json({
      id: invoice.id,
      invoice: wrappedInvoice.request,
    })
  } catch (error) {
    res.status(400).json({ error: error })
  }
})

router.get('/verify/:id', async (req, res) => {
  const { id } = req.params

  const { preimage } = await isInvoicePaid(id)

  let settled: any = false

  if (preimage) {
    const computedId = crypto
      .createHash('sha256')
      .update(Buffer.from(preimage, 'hex'))
      .digest('hex')
    settled = computedId === id
  }

  res.json({ preimage, settled })
})

export { router }
