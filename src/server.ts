import express from 'express'
import { env } from './env'
import { router } from './routes'

const app = express()

app.use(express.json())
app.use(router)

let isInitialized = false

export function startServer() {
  if (!isInitialized) {
    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`)
      isInitialized = true
    })
  }
}
