import process from 'node:process'
import { createGateway } from '../server/gateway.js'

export default {
  fetch(request: Request): Promise<Response> {
    return createGateway({
      origin: process.env.LOTTO_API_ORIGIN,
      token: process.env.LOTTO_ORIGIN_TOKEN,
    })(request)
  },
}
