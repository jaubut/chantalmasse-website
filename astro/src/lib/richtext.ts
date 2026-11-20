// Contract RichText → HTML for the blog body (rendered inside the same `prose` wrapper Nuxt Content used).
// Every text and attribute is escaped; hrefs are already restricted by the contract (https, mailto, tel, /path, #).
import type { Inline, RichNode, RichText } from './cms-client'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const SAFE_HREF = /^(https:\/\/|mailto:|tel:|\/(?!\/)|#)/

function inline(nodes: Inline[] = []): string {
  return nodes.map((n) => {
    if (n.type === 'hardBreak') return '<br>'
    let html = esc(n.text)
    for (const m of n.marks ?? []) {
      if (m.type === 'bold') html = `<strong>${html}</strong>`
      else if (m.type === 'italic') html = `<em>${html}</em>`
      else if (m.type === 'link' && SAFE_HREF.test(m.attrs.href)) {
        const blank = m.attrs.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
        html = `<a href="${esc(m.attrs.href)}"${blank}>${html}</a>`
      }
    }
    return html
  }).join('')
}

function node(n: RichNode): string {
  switch (n.type) {
    case 'paragraph': return `<p>${inline(n.content)}</p>`
    case 'heading': return `<h${n.attrs.level}>${inline(n.content)}</h${n.attrs.level}>`
    case 'image': {
      const { src, alt, width, height } = n.attrs
      const size = width && height ? ` width="${width}" height="${height}"` : ''
      return `<img src="${esc(src)}" alt="${esc(alt)}"${size} loading="lazy">`
    }
    case 'blockquote': return `<blockquote>${n.content.map(node).join('')}</blockquote>`
    case 'bulletList':
    case 'orderedList': {
      const tag = n.type === 'bulletList' ? 'ul' : 'ol'
      return `<${tag}>${n.content.map(li => `<li>${li.content.map(node).join('')}</li>`).join('')}</${tag}>`
    }
    default: return ''
  }
}

export const richTextToHtml = (doc: RichText): string => doc.content.map(node).join('\n')
