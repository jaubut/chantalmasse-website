export function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

export function cleanMultilineText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').slice(0, maxLength)
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

export function stripHeaderValue(value: unknown, maxLength: number): string {
  return cleanText(value, maxLength).replace(/[\r\n]/g, ' ')
}
