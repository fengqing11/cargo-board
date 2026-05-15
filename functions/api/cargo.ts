const KDOCS_API = 'https://www.kdocs.cn/api/v3/ide/file/csDYhtk0UKaq/script/V2-3npmjOBLq53lBH7k3XW64z/sync_task'
const AIRSCRIPT_TOKEN = '6fGqU99bv52z1X4GgGwyoV'
const REQUEST_TIMEOUT_MS = 20_000
const CACHE_TTL_MS = 60_000

type CacheEntry = {
  body: string
  contentType: string
  expiresAt: number
  status: number
}

const responseCache = new Map<string, CacheEntry>()

type PagesFunctionContext = {
  request: Request
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function cachedResponse(entry: CacheEntry) {
  return new Response(entry.body, {
    status: entry.status,
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
      'X-Cargo-Cache': 'HIT',
    },
  })
}

function upstreamResponse(entry: CacheEntry) {
  return new Response(entry.body, {
    status: entry.status,
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
      'X-Cargo-Cache': 'MISS',
    },
  })
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function onRequestPost({ request }: PagesFunctionContext) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const body = await request.text()
    const cacheKey = body || '{}'
    const now = Date.now()
    const cached = responseCache.get(cacheKey)

    if (cached && cached.expiresAt > now) {
      return cachedResponse(cached)
    }

    const upstream = await fetch(KDOCS_API, {
      method: 'POST',
      headers: {
        'AirScript-Token': AIRSCRIPT_TOKEN,
        'Content-Type': 'application/json',
      },
      body: cacheKey,
      signal: controller.signal,
    })

    const entry: CacheEntry = {
      body: await upstream.text(),
      contentType: upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
      expiresAt: now + CACHE_TTL_MS,
      status: upstream.status,
    }

    if (upstream.ok) {
      responseCache.set(cacheKey, entry)
    }

    return upstreamResponse(entry)
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error && error.name === 'AbortError' ? '请求金山 AirScript 超时' : 'Cargo API proxy failed',
      code: error instanceof Error && error.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'NETWORK_ERROR',
    }, 500)
  } finally {
    clearTimeout(timeout)
  }
}

export async function onRequest() {
  return jsonResponse({ message: 'Method not allowed' }, 405)
}
