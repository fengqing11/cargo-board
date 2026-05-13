import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.join(__dirname, 'dist')

const PORT = Number(process.env.PORT || 5173)
const KDOCS_API = process.env.KDOCS_API || 'https://www.kdocs.cn/api/v3/ide/file/csDYhtk0UKaq/script/V2-3npmjOBLq53lBH7k3XW64z/sync_task'
const AIRSCRIPT_TOKEN = process.env.AIRSCRIPT_TOKEN || '6fGqU99bv52z1X4GgGwyoV'
const REQUEST_TIMEOUT_MS = 20_000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function sendJson(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body || '{}'))
    req.on('error', reject)
  })
}

function proxyCargo(body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(KDOCS_API)
    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      headers: {
        'AirScript-Token': AIRSCRIPT_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (resp) => {
      let raw = ''
      resp.setEncoding('utf8')
      resp.on('data', (chunk) => {
        raw += chunk
      })
      resp.on('end', () => {
        resolve({
          statusCode: resp.statusCode || 502,
          contentType: resp.headers['content-type'] || 'application/json; charset=utf-8',
          body: raw,
        })
      })
    })

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(Object.assign(new Error('请求金山 AirScript 超时'), { code: 'UPSTREAM_TIMEOUT' }))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function handleCargo(req, res) {
  try {
    const body = await readRequestBody(req)
    const upstream = await proxyCargo(body)
    res.writeHead(upstream.statusCode, {
      'Content-Type': upstream.contentType,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(upstream.body)
  } catch (error) {
    sendJson(res, 500, {
      message: error instanceof Error ? error.message : 'Cargo API proxy failed',
      code: error?.code || 'NETWORK_ERROR',
    })
  }
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' }
    if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache'
    } else {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    }
    res.writeHead(200, headers)
    res.end(buf)
  })
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { message: 'Bad request' })
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/api/cargo') {
    await handleCargo(req, res)
    return
  }

  let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname.slice(1))
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html')
  }

  serveFile(res, filePath)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cargo board running at http://127.0.0.1:${PORT}`)
})
