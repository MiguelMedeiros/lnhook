import express from 'express'
import { env } from './env'
import { router } from './routes'
import { createLogger } from 'bunyan'

const log = createLogger({ name: 'server' })

const app = express()

app.use(express.json())
app.use(router)

let isInitialized = false

export function startServer() {
  if (!isInitialized) {
    app.listen(env.PORT, () => {
      log.info({ port: env.PORT }, 'Server is running')
      isInitialized = true
    })
  }
}
