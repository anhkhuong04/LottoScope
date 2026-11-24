export type OriginConfig = { origin?: string; token?: string }

export function validateOriginConfig(config: OriginConfig): { origin: URL; token: string } {
  const origin = new URL(config.origin ?? '')
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    !config.token ||
    config.token.length < 32
  ) {
    throw new Error('Invalid gateway configuration')
  }
  return { origin, token: config.token }
}

export function buildOriginHeaders(token: string, hasBody = false): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Lotto-Origin-Token': token,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  }
}
