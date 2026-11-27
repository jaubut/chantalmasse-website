// Local smoke server for Playwright (`playwright.config.ts` `webServer` when `SMOKE_BASE_URL` is unset).
// 1. Starts an in-process HTTP mock of the TLS CMS read contract v1 (`/v2/sites/chantal-masse/{posts,page,settings,media/*}`)
//    backed by the repo's 24 markdown articles in `content/blog/*.md`.
// 2. Writes a gitignored `astro/dist/server/wrangler.smoke.json` (running `bun run build` first if `wrangler.json` is absent)
//    that strips the remote `CMS` Worker service binding and injects `CMS_BASE_URL` pointing at the local mock CMS.
// 3. Spawns `bunx wrangler dev --config astro/dist/server/wrangler.smoke.json --ip 127.0.0.1 --port 8788 --local`.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Image, Inline, PostDoc, PostSummary, RichNode, RichText } from '../astro/src/lib/cms-client'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BLOG_DIR = join(REPO_ROOT, 'content/blog')
const WRANGLER_JSON = join(REPO_ROOT, 'astro/dist/server/wrangler.json')
const WRANGLER_SMOKE_JSON = join(REPO_ROOT, 'astro/dist/server/wrangler.smoke.json')
const WORKER_PORT = Number(process.env.SMOKE_PORT ?? 8788)

// Valid 1x1 JPEG so every `/media/*` image decodes with `naturalWidth === 1` (`content-type: image/jpeg`).
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
)

function parseInlines(raw: string): Inline[] {
  const out: Inline[] = []
  const tokenRe = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      out.push({ type: 'text', text: raw.slice(lastIndex, match.index) })
    }
    if (match[2] !== undefined) {
      out.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] })
    } else if (match[3] !== undefined) {
      out.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] })
    } else if (match[4] !== undefined && match[5] !== undefined) {
      out.push({ type: 'text', text: match[4], marks: [{ type: 'link', attrs: { href: match[5] } }] })
    }
    lastIndex = tokenRe.lastIndex
  }
  if (lastIndex < raw.length) {
    out.push({ type: 'text', text: raw.slice(lastIndex) })
  }
  return out.length > 0 ? out : [{ type: 'text', text: raw }]
}

function markdownToRichText(markdown: string): RichText {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const content: RichNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!.trim()
    if (!line) {
      i++
      continue
    }

    const headingMatch = line.match(/^(#{2,4})\s+(.+)$/)
    if (headingMatch) {
      const level = Math.min(4, Math.max(2, headingMatch[1]!.length)) as 2 | 3 | 4
      content.push({ type: 'heading', attrs: { level }, content: parseInlines(headingMatch[2]!.trim()) })
      i++
      continue
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ''))
        i++
      }
      content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: parseInlines(quoteLines.join(' ').trim()) }],
      })
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: Array<{ type: 'listItem', content: RichNode[] }> = []
      while (i < lines.length) {
        const current = lines[i]!.trim()
        if (!current) {
          // Allow blank lines between consecutive bullet list items
          let nextNonEmpty = i + 1
          while (nextNonEmpty < lines.length && !lines[nextNonEmpty]!.trim()) nextNonEmpty++
          if (nextNonEmpty < lines.length && /^[-*]\s+/.test(lines[nextNonEmpty]!.trim())) {
            i = nextNonEmpty
            continue
          }
          break
        }
        const bulletMatch = current.match(/^[-*]\s+(.+)$/)
        if (!bulletMatch) break
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInlines(bulletMatch[1]!.trim()) }],
        })
        i++
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: Array<{ type: 'listItem', content: RichNode[] }> = []
      while (i < lines.length) {
        const current = lines[i]!.trim()
        if (!current) {
          let nextNonEmpty = i + 1
          while (nextNonEmpty < lines.length && !lines[nextNonEmpty]!.trim()) nextNonEmpty++
          if (nextNonEmpty < lines.length && /^\d+\.\s+/.test(lines[nextNonEmpty]!.trim())) {
            i = nextNonEmpty
            continue
          }
          break
        }
        const orderedMatch = current.match(/^\d+\.\s+(.+)$/)
        if (!orderedMatch) break
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInlines(orderedMatch[1]!.trim()) }],
        })
        i++
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length
      && lines[i]!.trim()
      && !/^(#{2,4}\s+|>|[-*]\s+|\d+\.\s+)/.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!.trim())
      i++
    }
    content.push({ type: 'paragraph', content: parseInlines(paraLines.join(' ')) })
  }

  return { type: 'doc', content }
}

function parseFrontmatter(raw: string): { fm: Record<string, string>, body: string } {
  const match = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { fm: {}, body: raw }
  const fm: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!kv) continue
    let val = kv[2]!.trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).replace(/\\"/g, '"')
    }
    fm[kv[1]!] = val
  }
  return { fm, body: match[2]! }
}

function loadBlogPosts(): { list: PostDoc[], byPath: Map<string, PostDoc> } {
  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md')).sort()
  const list: PostDoc[] = []
  const byPath = new Map<string, PostDoc>()

  for (const file of files) {
    const raw = readFileSync(join(BLOG_DIR, file), 'utf8')
    const { fm, body } = parseFrontmatter(raw)
    const slug = (fm.slug || file.replace(/\.md$/, '')).trim()
    const path = `/blog/${slug}`
    const title = fm.title || slug
    const date = (fm.date || '2026-01-01').slice(0, 10)
    const excerpt = fm.excerpt || fm.description || ''
    const category = fm.category || ''
    const readingMinutes = Number(fm.readTime ?? fm.readingTime) || null
    const hero: Image = {
      src: `/media/${slug}.jpg`,
      alt: title,
      width: 1200,
      height: 630,
      focal: null,
    }
    const doc: PostDoc = {
      id: `chantal-masse:post:${slug}`,
      type: 'post',
      locale: 'fr',
      fallbackFrom: null,
      path,
      title,
      date,
      excerpt,
      hero,
      readingMinutes,
      authors: [{ id: 'chantal-masse:author:chantal', name: 'Chantal Massé', path: null, avatar: null }],
      categories: category
        ? [{ id: `chantal-masse:category:${category}`, kind: 'category', slug: category, title: category, path: null }]
        : [],
      tags: [],
      seo: {
        title,
        description: excerpt || null,
        image: hero,
        noindex: false,
        canonical: null,
      },
      body: markdownToRichText(body),
      updatedAt: `${date}T00:00:00.000Z`,
    }
    list.push(doc)
    byPath.set(path, doc)
  }

  list.sort((a, b) => b.date.localeCompare(a.date) || a.path.localeCompare(b.path))
  return { list, byPath }
}

function toSummary(doc: PostDoc): PostSummary {
  return {
    id: doc.id,
    locale: doc.locale,
    fallbackFrom: doc.fallbackFrom,
    path: doc.path,
    title: doc.title,
    date: doc.date,
    excerpt: doc.excerpt,
    hero: doc.hero,
    readingMinutes: doc.readingMinutes,
    authors: doc.authors,
    categories: doc.categories,
    tags: doc.tags,
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function startMockCms(): Promise<{ port: number, close: () => Promise<void> }> {
  const { list, byPath } = loadBlogPosts()
  const prefix = '/v2/sites/chantal-masse/'

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (!url.pathname.startsWith(prefix)) {
      sendJson(res, 404, { error: 'not_found' })
      return
    }
    const route = url.pathname.slice(prefix.length)

    if (route === 'posts') {
      const category = url.searchParams.get('category')
      const sort = url.searchParams.get('sort') ?? 'date_desc'
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
      const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50)

      let filtered = category
        ? list.filter(p => p.categories.some(c => c.slug === category))
        : [...list]

      if (sort === 'date_asc') {
        filtered.sort((a, b) => a.date.localeCompare(b.date) || a.path.localeCompare(b.path))
      } else if (sort === 'title') {
        filtered.sort((a, b) => a.title.localeCompare(b.title))
      } else {
        filtered.sort((a, b) => b.date.localeCompare(a.date) || a.path.localeCompare(b.path))
      }

      const total = filtered.length
      const pages = Math.max(1, Math.ceil(total / limit))
      const items = filtered.slice((page - 1) * limit, page * limit).map(toSummary)
      sendJson(res, 200, {
        data: { items, page, limit, total, pages },
        meta: { version: 1, tags: [] },
      })
      return
    }

    if (route === 'page') {
      const reqPath = url.searchParams.get('path') ?? ''
      const post = byPath.get(reqPath)
      if (post) {
        sendJson(res, 200, { data: post, meta: { version: 1, tags: [] } })
        return
      }
      sendJson(res, 404, { error: 'not_found' })
      return
    }

    if (route === 'settings') {
      sendJson(res, 404, { error: 'not_found' })
      return
    }

    if (route.startsWith('media/')) {
      res.writeHead(200, {
        'content-type': 'image/jpeg',
        'content-length': TINY_JPEG.byteLength,
        'cache-control': 'public, max-age=31536000, immutable',
      })
      res.end(TINY_JPEG)
      return
    }

    sendJson(res, 404, { error: 'not_found' })
  })

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => resolveListen())
  })

  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind local mock CMS server')
  return {
    port: addr.port,
    close: () => new Promise<void>(resolveClose => server.close(() => resolveClose())),
  }
}

async function waitForReady(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return
    } catch {
      // Wrangler still starting
    }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function main(): Promise<void> {
  if (!existsSync(WRANGLER_JSON)) {
    const build = spawnSync('bun', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' })
    if (build.status !== 0) process.exit(build.status ?? 1)
  }

  const cms = await startMockCms()
  const rawConfig = JSON.parse(readFileSync(WRANGLER_JSON, 'utf8')) as Record<string, unknown>
  delete rawConfig.services
  const existingVars = (rawConfig.vars && typeof rawConfig.vars === 'object' ? rawConfig.vars : {}) as Record<string, string>
  rawConfig.vars = {
    ...existingVars,
    CMS_BASE_URL: `http://127.0.0.1:${cms.port}`,
  }
  writeFileSync(WRANGLER_SMOKE_JSON, JSON.stringify(rawConfig, null, 2))

  const wrangler = spawn(
    'bunx',
    [
      'wrangler',
      'dev',
      '--config',
      'astro/dist/server/wrangler.smoke.json',
      '--ip',
      '127.0.0.1',
      '--port',
      String(WORKER_PORT),
      '--local',
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, TZ: 'UTC' },
    },
  )

  let shuttingDown = false
  const shutdown = async (code = 0): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    if (wrangler.exitCode === null) {
      wrangler.kill('SIGTERM')
    }
    await cms.close().catch(() => {})
    process.exit(code)
  }

  process.on('SIGINT', () => void shutdown(0))
  process.on('SIGTERM', () => void shutdown(0))

  wrangler.on('exit', (code) => {
    void shutdown(code ?? 0)
  })

  await waitForReady(`http://127.0.0.1:${WORKER_PORT}/`)
}

await main()
