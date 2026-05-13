const KDOCS_API = 'https://www.kdocs.cn/api/v3/ide/file/csDYhtk0UKaq/script/V2-3npmjOBLq53lBH7k3XW64z/sync_task'
const AIRSCRIPT_TOKEN = '6fGqU99bv52z1X4GgGwyoV'
const REQUEST_TIMEOUT_MS = 20_000

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
    const upstream = await fetch(KDOCS_API, {
      method: 'POST',
      headers: {
        'AirScript-Token': AIRSCRIPT_TOKEN,
        'Content-Type': 'application/json',
      },
      body: body || '{}',
      signal: controller.signal,
    })

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
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
