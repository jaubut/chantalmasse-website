// Contract-level `data-tls-*` attribute helpers, cryptographic HS256 preview token verification,
// preview cookie utilities, and dormant loader builder for Stage 4b (S4b) of the `tls-cms` on-site
// floating-bar editor (`chantal-masse`).
// Every attribute helper returns `{}` when `previewMode` is false so public live renders emit 0 `data-tls-*` attributes.

export const SITE_ID = 'chantal-masse'
export const DEFAULT_LOCALE = 'fr'
export const PREVIEW_COOKIE = '__tls_preview'
export const PREVIEW_MAX_AGE = 3600
export const MAX_PREVIEW_TOKEN_LENGTH = 2048
export const SAFE_PREVIEW_PATH_RE = /^\/(?!\/)[^\s\\]*$/
export const DEFAULT_TLS_EDIT_ORIGIN = 'https://dashboard.apies.dev'

export function isValidPreviewToken(token: unknown): token is string {
  return (
    typeof token === 'string'
    && token.length > 0
    && token.length <= MAX_PREVIEW_TOKEN_LENGTH
    && !/[\x00-\x1f\x7f;\s]/.test(token)
  )
}

// ---------- Web Crypto HS256 JWT verification matching `tls-cms` (`cms/worker/src/auth.ts` `signPreview`) ----------

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function base64UrlDecodeBytes(seg: string): Uint8Array | null {
  if (!seg || !/^[A-Za-z0-9_-]+$/.test(seg)) return null
  const pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4))
  try {
    const bin = atob(seg.replace(/-/g, '+').replace(/_/g, '/') + pad)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function base64UrlDecodeJson(seg: string): Record<string, unknown> | null {
  const bytes = base64UrlDecodeBytes(seg)
  if (!bytes) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export interface PreviewTokenClaims {
  aud: 'tls-preview'
  site: string
  exp: number
}

/**
 * Validates the structural JWT claims of a `tls-cms` preview token:
 * `header.alg === "HS256"`, `payload.aud === "tls-preview"`, `payload.site === expectedSite`,
 * and `now < payload.exp <= now + 3600 (+ 60s clock skew)`.
 */
export function parsePreviewJwtClaims(
  token: string,
  expectedSite = SITE_ID,
  nowMs = Date.now(),
): PreviewTokenClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [hSeg, pSeg, sSeg] = parts as [string, string, string]
  if (!hSeg || !pSeg || !sSeg) return null
  const header = base64UrlDecodeJson(hSeg)
  if (!header || header.alg !== 'HS256') return null
  const payload = base64UrlDecodeJson(pSeg)
  if (!payload) return null
  if (payload.aud !== 'tls-preview' || payload.site !== expectedSite) return null
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null
  const nowS = Math.floor(nowMs / 1000)
  if (payload.exp <= nowS || payload.exp > nowS + PREVIEW_MAX_AGE + 60) return null
  return { aud: 'tls-preview', site: expectedSite, exp: payload.exp }
}

/**
 * Signs an HS256 preview token identical to `tls-cms` (`cms/worker/src/auth.ts` `signPreview`).
 */
export async function signPreviewToken(
  site = SITE_ID,
  secret: string,
  nowMs = Date.now(),
  ttlS = PREVIEW_MAX_AGE,
): Promise<string> {
  const header = base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' })
  const payload = base64UrlEncodeJson({
    aud: 'tls-preview',
    site,
    exp: Math.floor(nowMs / 1000) + ttlS,
  })
  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(sig))}`
}

/**
 * Verifies a `__tls_preview` token:
 * - Always checks `isValidPreviewToken`.
 * - When `secret` (`PREVIEW_SECRET`) is configured, cryptographically verifies the HS256 signature
 *   via Web Crypto `crypto.subtle.verify` and checks `{ aud: "tls-preview", site: expectedSite, exp }`.
 * - When `secret` is not configured, still validates JWT claims if the token has dot-separated segments.
 */
export async function verifyPreviewToken(
  token: unknown,
  secret?: string | null,
  expectedSite = SITE_ID,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!isValidPreviewToken(token)) return false
  const trimmedSecret = secret?.trim()
  if (!trimmedSecret) {
    if (token.includes('.')) {
      return parsePreviewJwtClaims(token, expectedSite, nowMs) !== null
    }
    return true
  }
  const claims = parsePreviewJwtClaims(token, expectedSite, nowMs)
  if (!claims) return false
  const [hSeg, pSeg, sSeg] = token.split('.') as [string, string, string]
  const sigBytes = base64UrlDecodeBytes(sSeg)
  if (!sigBytes) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(trimmedSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    'HMAC',
    key,
    new Uint8Array(sigBytes),
    new TextEncoder().encode(`${hSeg}.${pSeg}`),
  )
}

export function validatePreviewPath(rawPath: string | null | undefined): string | null {
  if (rawPath === null || rawPath === undefined || rawPath === '') return '/'
  if (typeof rawPath !== 'string' || rawPath.length > 2048) return null
  if (!SAFE_PREVIEW_PATH_RE.test(rawPath) || /[\x00-\x1f\x7f]/.test(rawPath)) return null
  try {
    const parsed = new URL(rawPath, 'https://chantalmasse.local')
    if (parsed.origin !== 'https://chantalmasse.local' || !SAFE_PREVIEW_PATH_RE.test(parsed.pathname)) {
      return null
    }
    // Reject encoded protocol-relative or backslash paths after URL normalization (e.g. /%2f/evil.com or /%5cevil.com).
    const decodedPath = decodeURIComponent(parsed.pathname)
    if (!SAFE_PREVIEW_PATH_RE.test(decodedPath) || /[\x00-\x1f\x7f]/.test(decodedPath)) {
      return null
    }
  } catch {
    return null
  }
  return rawPath
}

export function readPreviewCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (name !== PREVIEW_COOKIE) continue
    const raw = part.slice(eq + 1).trim()
    if (!raw) return null
    let decoded = raw
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      decoded = raw
    }
    return isValidPreviewToken(decoded) ? decoded : null
  }
  return null
}

export function hasRawPreviewCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false
  return cookieHeader.split(';').some((part) => {
    const eq = part.indexOf('=')
    const name = (eq < 0 ? part : part.slice(0, eq)).trim()
    const val = eq < 0 ? '' : part.slice(eq + 1).trim()
    return name === PREVIEW_COOKIE && val.length > 0
  })
}

export function hasPreviewCookie(cookieHeader: string | null | undefined): boolean {
  return readPreviewCookie(cookieHeader) !== null
}

export function buildPreviewSetCookie(token: string | null, isHttps: boolean): string {
  const value = token ?? ''
  const maxAge = token ? PREVIEW_MAX_AGE : 0
  return `${PREVIEW_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps ? '; Secure' : ''}`
}

export function applyPreviewResponseHeaders(headers: Headers, previewMode: boolean): void {
  if (!previewMode) return
  headers.set('Cache-Control', 'private, no-store')
  const existingRobots = headers.get('X-Robots-Tag')
  if (!existingRobots || !existingRobots.includes('noindex')) {
    headers.set('X-Robots-Tag', 'noindex')
  }
}

// ---------- Document ID helpers ----------

export const pageDocId = (handle: string, siteId = SITE_ID): string => `${siteId}:page:${handle}`
export const postDocId = (slug: string, siteId = SITE_ID): string => `${siteId}:post:${slug.replace(/^\/?blog\//, '')}`
export const itemDocId = (kind: string, handle: string, siteId = SITE_ID): string => `${siteId}:item:${kind}:${handle}`
export const serviceDocId = (handle: string, siteId = SITE_ID): string => itemDocId('service', handle, siteId)
export const settingsDocId = (siteId = SITE_ID): string => `${siteId}:settings:site`

export function pageDocIdForPath(pathname: string, siteId = SITE_ID): string {
  const clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/'
  if (clean === '/') return pageDocId('home', siteId)
  if (clean === '/blog') return pageDocId('blog', siteId)
  if (clean.startsWith('/blog/')) return postDocId(clean.slice('/blog/'.length), siteId)
  const handle = clean.replace(/^\/+/, '').replace(/\//g, '-')
  return pageDocId(handle || 'home', siteId)
}

// ---------- Contract-level field & image path builders ----------

export const blockFieldPath = (docId: string, blockKey: string, path: string): string =>
  `doc:${docId}/blocks/${blockKey}/data/${path}`

export const entryFieldPath = (docId: string, field = 'title'): string =>
  `doc:${docId}/entry/${field}`

export const extFieldPath = (docId: string, field: string): string =>
  `doc:${docId}/ext/${field}`

export const settingsFieldPath = (settingsId: string, field: string): string =>
  `doc:${settingsId}/settings/${field}`

export const blockImagePath = (docId: string, blockKey: string, imagePath = 'image'): string =>
  `doc:${docId}/blocks/${blockKey}/data/${imagePath}`

export const postHeroImagePath = (postId: string): string =>
  `doc:${postId}/ext/heroMediaId`

export const itemImagePath = (itemId: string): string =>
  `doc:${itemId}/ext/mediaId`

// ---------- Contract-level `data-tls-*` attribute helpers (gated by `previewMode`) ----------

export function tlsPageAttrs(
  previewMode: boolean,
  pageOrPostDocId: string | null | undefined,
  locale = DEFAULT_LOCALE,
): Record<string, string> {
  if (!previewMode || !pageOrPostDocId) return {}
  return {
    'data-tls-page': pageOrPostDocId,
    'data-tls-locale': locale,
  }
}

export function tlsBlockAttrs(
  previewMode: boolean,
  blockKey: string,
  blockType: string,
): Record<string, string> {
  if (!previewMode || !blockKey || !blockType) return {}
  return {
    'data-tls-block': blockKey,
    'data-tls-block-type': blockType,
  }
}

export function tlsFieldAttrs(
  previewMode: boolean,
  fieldPath: string,
): Record<string, string> {
  if (!previewMode || !fieldPath) return {}
  return { 'data-tls-field': fieldPath }
}

export function tlsBlockFieldAttrs(
  previewMode: boolean,
  docId: string,
  blockKey: string,
  path: string,
): Record<string, string> {
  if (!previewMode || !docId || !blockKey || !path) return {}
  return { 'data-tls-field': blockFieldPath(docId, blockKey, path) }
}

export function tlsEntryFieldAttrs(
  previewMode: boolean,
  docId: string,
  field = 'title',
): Record<string, string> {
  if (!previewMode || !docId || !field) return {}
  return { 'data-tls-field': entryFieldPath(docId, field) }
}

export function tlsExtFieldAttrs(
  previewMode: boolean,
  docId: string,
  field: string,
): Record<string, string> {
  if (!previewMode || !docId || !field) return {}
  return { 'data-tls-field': extFieldPath(docId, field) }
}

export function tlsSettingsFieldAttrs(
  previewMode: boolean,
  settingsId: string,
  field: string,
): Record<string, string> {
  if (!previewMode || !settingsId || !field) return {}
  return { 'data-tls-field': settingsFieldPath(settingsId, field) }
}

export function tlsImageAttrs(
  previewMode: boolean,
  imagePath: string,
): Record<string, string> {
  if (!previewMode || !imagePath) return {}
  return { 'data-tls-image': imagePath }
}

export function tlsBlockImageAttrs(
  previewMode: boolean,
  docId: string,
  blockKey: string,
  imagePath = 'image',
): Record<string, string> {
  if (!previewMode || !docId || !blockKey || !imagePath) return {}
  return { 'data-tls-image': blockImagePath(docId, blockKey, imagePath) }
}

export function tlsPostHeroImageAttrs(
  previewMode: boolean,
  postId: string,
): Record<string, string> {
  if (!previewMode || !postId) return {}
  return { 'data-tls-image': postHeroImagePath(postId) }
}

export function tlsItemImageAttrs(
  previewMode: boolean,
  itemId: string,
): Record<string, string> {
  if (!previewMode || !itemId) return {}
  return { 'data-tls-image': itemImagePath(itemId) }
}

export function tlsCollectionAttrs(
  previewMode: boolean,
  kindOrPost: string,
): Record<string, string> {
  if (!previewMode || !kindOrPost) return {}
  return { 'data-tls-collection': kindOrPost }
}

export function tlsItemAttrs(
  previewMode: boolean,
  docId: string,
  kindOrPost: string,
): Record<string, string> {
  if (!previewMode || !docId || !kindOrPost) return {}
  return {
    'data-tls-item': docId,
    'data-tls-kind': kindOrPost,
  }
}

// ---------- Layout preview state resolution (shared by `Base.astro` and unit tests) ----------

export interface ResolveBaseLayoutTlsInput {
  isPrerendered?: boolean
  locals?: { previewToken?: string | null, previewMode?: boolean }
  cookieHeader?: string | null
  pageDocId?: string | null
  path: string
  locale?: string
  previewModeProp?: boolean
  editOrigin?: string
}

export interface ResolvedBaseLayoutTls {
  previewToken: string | null
  previewMode: boolean
  resolvedPageDocId: string
  mainAttrs: Record<string, string>
  loaderScript: string
}

export function resolveBaseLayoutTls(input: ResolveBaseLayoutTlsInput): ResolvedBaseLayoutTls {
  const isPrerendered = Boolean(input.isPrerendered)
  const previewToken = isPrerendered
    ? null
    : (input.locals?.previewToken !== undefined ? input.locals.previewToken : readPreviewCookie(input.cookieHeader))
  const previewMode = input.previewModeProp ?? (isPrerendered ? false : (input.locals?.previewMode ?? Boolean(previewToken)))
  const resolvedPageDocId = input.pageDocId ?? pageDocIdForPath(input.path)
  const mainAttrs = tlsPageAttrs(previewMode, resolvedPageDocId, input.locale ?? DEFAULT_LOCALE)
  const loaderScript = buildDormantLoaderScript(input.editOrigin)
  return { previewToken, previewMode, resolvedPageDocId, mainAttrs, loaderScript }
}

// ---------- Zero-cost dormant inline loader (~450 B) ----------

export function resolveTlsEditOrigin(raw?: string): string {
  const trimmed = raw?.trim()
  if (!trimmed) return DEFAULT_TLS_EDIT_ORIGIN
  try {
    const u = new URL(trimmed)
    if (u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return u.origin
    }
  } catch {
    // ignore invalid origin
  }
  return DEFAULT_TLS_EDIT_ORIGIN
}

export function buildDormantLoaderScript(rawOrigin?: string): string {
  const origin = JSON.stringify(resolveTlsEditOrigin(rawOrigin))
  return `(()=>{const l=()=>{try{const g=sessionStorage,t=new URLSearchParams(location.search).get("tls_edit");if(t){g.setItem("tls_edit_v2_token",t);const u=new URL(location.href);u.searchParams.delete("tls_edit");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}if(t||g.getItem("tls_edit_v2_bearer")||g.getItem("tls_edit_v2_token")){window.__tlsEditOrigin=${origin};if(!document.getElementById("tls-edit-v2-script")){const s=document.createElement("script");s.id="tls-edit-v2-script";s.src=window.__tlsEditOrigin+"/tls-edit-v2.js";s.defer=true;document.head.append(s)}}}catch{}};l();if(!window.__tlsEditL){window.__tlsEditL=1;document.addEventListener("astro:page-load",l)}})()`
}
