import { handleBotMiddleware } from './server/botMiddleware.js'

export const config = {
  matcher: ['/', '/dashboard', '/history', '/numbers', '/pairs'],
}

export default function middleware(request: Request): Response {
  return handleBotMiddleware(request)
}
