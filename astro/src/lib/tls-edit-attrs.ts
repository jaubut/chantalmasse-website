// Contract-level `data-tls-*` attribute helpers, preview cookie utilities, and dormant loader builder
// for Stage 4b (S4b) of the `tls-cms` on-site floating-bar editor (`chantal-masse`).
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
  headers.set('X-Robots-Tag', 'noindex')
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
  return `(()=>{const l=()=>{try{const g=sessionStorage,t=new URLSearchParams(location.search).get("tls_edit");if(t){g.setItem("tls_edit_v2_token",t);const u=new URL(location.href);u.searchParams.delete("tls_edit");history.replaceState(history.state,"",u.pathname+u.search+u.hash)}if(t||g.getItem("tls_edit_v2_bearer")||g.getItem("tls_edit_v2_token")){window.__tlsEditOrigin=${origin};if(!document.getElementById("tls-edit-v2-script")){const s=document.createElement("script");s.id="tls-edit-v2-script";s.src="/tls-edit-v2.js";s.defer=true;document.head.append(s)}}}catch{}};l();document.addEventListener("astro:page-load",l)})()`
}
