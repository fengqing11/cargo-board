const KDOCS_API = 'http://117.72.67.127:30080/wps/api/v3/ide/file/csDYhtk0UKaq/script/V2-3npmjOBLq53lBH7k3XW64z/sync_task'
const AIRSCRIPT_TOKEN = '6fGqU99bv52z1X4GgGwyoV'

export const onRequestPost: PagesFunction = async ({ request }) => {
  try {
    const body = await request.text()
    const upstream = await fetch(KDOCS_API, {
      method: 'POST',
      headers: {
        'AirScript-Token': AIRSCRIPT_TOKEN,
        'Content-Type': 'application/json',
      },
      body,
    })

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : 'Cargo API proxy failed' },
      { status: 500 },
    )
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
    },
  })
}
