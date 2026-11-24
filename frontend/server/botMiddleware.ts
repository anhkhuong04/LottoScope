const AI_BOT_RE =
  /(?:OAI-SearchBot|ChatGPT-User|GPTBot|ClaudeBot|Claude-Web|PerplexityBot|Anthropic-AI|Google-Extended)/i

const BOT_HTML_PATHS = new Set(['/', '/dashboard', '/history', '/numbers', '/pairs'])

export function isAiCrawler(userAgent: string | null): boolean {
  return Boolean(userAgent && AI_BOT_RE.test(userAgent))
}

export function handleBotMiddleware(request: Request): Response {
  const url = new URL(request.url)
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    BOT_HTML_PATHS.has(url.pathname) &&
    isAiCrawler(request.headers.get('user-agent'))
  ) {
    const target = new URL('/api/data', url.origin)
    target.search = url.search
    return new Response(null, {
      headers: {
        'x-middleware-rewrite': target.toString(),
        Vary: 'User-Agent',
      },
    })
  }

  return new Response(null, {
    headers: {
      'x-middleware-next': '1',
    },
  })
}
