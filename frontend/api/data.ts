import process from 'node:process'
import { createDataHandler } from '../server/dataPage.js'

export default {
  fetch(request: Request): Promise<Response> {
    return createDataHandler({
      origin: process.env.LOTTO_API_ORIGIN,
      token: process.env.LOTTO_ORIGIN_TOKEN,
    })(request)
  },
}
