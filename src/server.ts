import express from 'express'
import http from 'http'
import { createLogger } from 'bunyan'
import { Server } from 'socket.io'
import { env } from './env'
import { router } from './routes'

const app = express()
const server = http.createServer(app)

export const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

app.use(express.json())
app.use(router)

let isInitialized = false

export function startServer() {
  if (!isInitialized) {
    const log = createLogger({ name: 'server' })

    io.on('connection', (socket) => {
      log.info({ id: socket.id }, 'Client connected')
    })

    server.listen(env.PORT, () => {
      log.info({ port: env.PORT }, 'Server is running')
      isInitialized = true
    })
  }
}
