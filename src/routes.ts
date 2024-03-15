import express from 'express'
import crypto from 'node:crypto'
import swaggerUI from 'swagger-ui-express'
import { z } from 'zod'
import { isInvoicePaid, validateInvoice, wrapInvoice } from './lnd'
import { env } from './env'
import swaggerDocument from './assets/swagger.json'

const router = express.Router()

let metadatas = {}

swaggerDocument.servers[0].url = env.HOST
router.use('/api', swaggerUI.serve)
router.get('/api', swaggerUI.setup(swaggerDocument, {
  explorer: false,
  swaggerOptions: {
    supportedSubmitMethods: []
  }
}))
router.get('/api-json', (req, res) => {
  res.json(swaggerDocument)
})

router.post('/wrap', async (req, res) => {
  const requestSchema = z.object({
    invoice: z.string().min(1),
    webhook: z.string().url().optional(),
    metadata: z.unknown().optional()
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
    const { request, ...fees } = await wrapInvoice(
      invoice,
      parsedRequest.data.invoice,
      parsedRequest.data.webhook,
      parsedRequest.data.metadata
    )

    metadatas[invoice.id] = parsedRequest.data.metadata

    res.json({
      id: invoice.id,
      invoice: request,
      ...fees,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/verify/:id', async (req, res) => {
  const { id } = req.params

  let preimage: string | null = null
  let settled = false

  try {
    const invoice = await isInvoicePaid(id)
    preimage = invoice.preimage
  } catch (error) {
    //
  }

  if (preimage) {
    const computedId = crypto
      .createHash('sha256')
      .update(Buffer.from(preimage, 'hex'))
      .digest('hex')
    settled = computedId === id
  }

  res.json({ preimage, settled, metadata: metadatas[id] || {} })
})

export { router }
