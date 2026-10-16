import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import textile from 'textile-js'

/**
 * Texto con formato de Redmine (F3-T03): descripciones, comentarios y wiki.
 *
 * El formato (textile, markdown o commonmark) es una opción del administrador que
 * la API no expone (sdd/03-api-redmine.md › Riesgos), así que se adivina por el
 * propio texto y la persona puede fijarlo en Preferencias. Todo HTML generado pasa
 * por DOMPurify antes de pintarse: un `<script>` en una descripción no se ejecuta.
 */

export type TextFormat = 'textile' | 'markdown'
export type FormatPreference = 'auto' | TextFormat

const MARKDOWN_SIGNS = [
  /^#{1,6}\s+\S/m, // # Título
  /\*\*[^*\n]+\*\*/, // **negrita**
  /^```/m, // bloque de código
  /\[[^\]\n]+\]\([^)\s]+\)/, // [texto](url)
  /`[^`\n]+`/, // `código`
  /^\s*\d+\.\s+\S/m, // 1. lista
]

const TEXTILE_SIGNS = [
  /^h[1-6]\.\s+\S/m, // h2. Título
  /^bq\.\s/m, // bq. cita
  /"[^"\n]+":(?:https?:\/\/|\/)\S+/, // "texto":url
  /<pre>|<code>/, // bloques de código de textile
  /^\*\s+\S.*\n\*\s+\S/m, // * lista (en markdown suele ir con -)
  /@[^@\s][^@\n]*@/, // @código@
  /^\|.*\|\s*$/m, // | tabla |
  /^#\s+\S.*\n#\s+\S/m, // # lista numerada (dos seguidas: no es un título)
]

/** Formato más probable. Ante la duda, textile: es el valor por defecto de Redmine. */
export function detectFormat(text: string): TextFormat {
  const score = (signs: RegExp[]) => signs.reduce((n, sign) => n + (sign.test(text) ? 1 : 0), 0)
  return score(MARKDOWN_SIGNS) > score(TEXTILE_SIGNS) ? 'markdown' : 'textile'
}

export function resolveFormat(text: string, preference: FormatPreference): TextFormat {
  return preference === 'auto' ? detectFormat(text) : preference
}

let markdown: InstanceType<typeof MarkdownIt> | undefined

/** HTML sin sanear. Solo para `renderRichText`. */
function toHtml(text: string, format: TextFormat): string {
  if (format === 'markdown') {
    // `html: false`: el HTML escrito a mano en markdown no se interpreta (Redmine tampoco lo hace).
    markdown ??= new MarkdownIt({ html: false, linkify: true, breaks: true })
    return markdown.render(text)
  }
  return textile.parse(text, { breaks: true })
}

/** Redmine escribe así las referencias a tareas: `#N`, no dentro de una palabra ni de una URL. */
const ISSUE_REF = /(^|[\s(>[,;])#(\d+)\b/g

/**
 * Convierte `#N` en enlaces a la tarea dentro de la app, recorriendo solo los
 * nodos de texto (nunca dentro de `<a>`, `<code>` o `<pre>`).
 */
function linkIssueRefs(root: DocumentFragment): void {
  const doc = root.ownerDocument
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)

  for (const node of nodes) {
    if (node.parentElement?.closest('a, code, pre')) continue
    const text = node.data
    ISSUE_REF.lastIndex = 0
    if (!ISSUE_REF.test(text)) continue
    ISSUE_REF.lastIndex = 0

    const fragment = doc.createDocumentFragment()
    let last = 0
    for (const match of text.matchAll(ISSUE_REF)) {
      const start = match.index + match[1]!.length
      fragment.append(text.slice(last, start))
      const link = doc.createElement('a')
      link.href = `/issues/${match[2]}`
      link.dataset.issue = match[2]!
      link.textContent = `#${match[2]}`
      fragment.append(link)
      last = start + match[2]!.length + 1
    }
    fragment.append(text.slice(last))
    node.replaceWith(fragment)
  }
}

/**
 * Texto de Redmine → HTML saneado y listo para `v-html`. Los enlaces externos se
 * abren en otra pestaña; los `#N` llevan a la tarea dentro de la app.
 */
export function renderRichText(text: string, format: TextFormat): string {
  // Sin un DOM que DOMPurify reconozca, `sanitize` devuelve la entrada tal cual:
  // antes que pintar HTML sin sanear, se muestra el texto escapado.
  if (!DOMPurify.isSupported) return `<p>${escapeHtml(text).replaceAll('\n', '<br>')}</p>`

  const clean = DOMPurify.sanitize(toHtml(text, format), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'],
    FORBID_ATTR: ['style'],
  })

  // Un <template> no ejecuta nada ni carga imágenes: sirve para retocar el HTML ya saneado.
  const template = document.createElement('template')
  template.innerHTML = clean
  linkIssueRefs(template.content)
  for (const link of template.content.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (link.dataset.issue) continue
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
  return template.innerHTML
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

// ------------------------------------------------------------------ editor

export type Markup = 'bold' | 'list' | 'code'

const MARKS: Record<TextFormat, { bold: string, code: string, list: string }> = {
  textile: { bold: '*', code: '@', list: '* ' },
  markdown: { bold: '**', code: '`', list: '- ' },
}

/**
 * Aplica un atajo del editor a la selección `[start, end)` y devuelve el texto y la
 * nueva selección. Negrita y código envuelven; lista antepone la marca a cada línea.
 */
export function applyMarkup(
  text: string,
  start: number,
  end: number,
  kind: Markup,
  format: TextFormat,
): { text: string, start: number, end: number } {
  const marks = MARKS[format]
  if (kind === 'list') {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const block = text.slice(lineStart, end)
    const listed = block.split('\n').map(line => `${marks.list}${line}`).join('\n')
    return { text: text.slice(0, lineStart) + listed + text.slice(end), start: lineStart, end: lineStart + listed.length }
  }
  const mark = kind === 'bold' ? marks.bold : marks.code
  const selected = text.slice(start, end)
  return {
    text: `${text.slice(0, start)}${mark}${selected}${mark}${text.slice(end)}`,
    start: start + mark.length,
    end: end + mark.length,
  }
}
