/**
 * Verifica los contrastes de la paleta (F0-T04).
 *
 * Lee app/assets/css/tokens.css, resuelve las cuatro combinaciones que el sistema
 * puede pedir (claro, claro+alto contraste, oscuro, oscuro+alto contraste) y comprueba
 * los pares de sdd/02-diseno.md › Color contra el mínimo de WCAG 2.x para texto.
 *
 * Uso: pnpm check:contrast
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TOKENS = fileURLToPath(new URL('../app/assets/css/tokens.css', import.meta.url))

/** Mínimo para texto normal (hasta 17 pt). Ver sdd/02-diseno.md › Accesibilidad. */
const MIN_RATIO = 4.5

/** Mínimo para iconos y glifos de control (WCAG 1.4.11, contraste no textual). */
const MIN_RATIO_ICON = 3

/** Pares `texto sobre fondo` que la interfaz usa de verdad. `min` por defecto: MIN_RATIO. */
const PAIRS: ReadonlyArray<{ fg: string, bg: string, usage: string, min?: number }> = [
  { fg: 'content', bg: 'surface', usage: 'Texto principal' },
  { fg: 'content', bg: 'raised', usage: 'Texto en panel, popover o diálogo' },
  { fg: 'content', bg: 'fill-selected', usage: 'Fila seleccionada' },
  { fg: 'content', bg: 'sidebar', usage: 'Barra lateral' },
  { fg: 'content-secondary', bg: 'surface', usage: 'Metadatos y conjunciones de la frase' },
  { fg: 'content-secondary', bg: 'raised', usage: 'Metadatos sobre panel' },
  { fg: 'content-secondary', bg: 'fill-alt', usage: 'Metadatos en fila alterna' },
  { fg: 'content-secondary', bg: 'fill-hover', usage: 'Metadatos en fila con hover' },
  { fg: 'content-secondary', bg: 'sidebar', usage: 'Contadores de la barra lateral' },
  { fg: 'content-tertiary', bg: 'raised', usage: 'Iconos de control (▲▼)', min: MIN_RATIO_ICON },
  { fg: 'content-tertiary', bg: 'fill-alt', usage: 'Iconos de control en fila alterna', min: MIN_RATIO_ICON },
  { fg: 'accent', bg: 'surface', usage: 'Enlace o acción primaria en texto' },
  { fg: 'accent', bg: 'raised', usage: 'Acción primaria en popover' },
  { fg: 'on-accent', bg: 'accent', usage: 'Texto del botón primario y RTQA' },
  { fg: 'on-board', bg: 'board', usage: 'Cifras de la franja de salidas y placas' },
  { fg: 'on-board-secondary', bg: 'board', usage: 'Etiquetas de la franja de salidas' },
  { fg: 'on-change', bg: 'change-fill', usage: 'Etiqueta "Subida · ahora"' },
  { fg: 'content', bg: 'change-fill', usage: 'Fila cambiada' },
  { fg: 'signal-success', bg: 'raised', usage: 'Estado correcto' },
  { fg: 'signal-warning', bg: 'raised', usage: 'Aviso' },
  { fg: 'signal-info', bg: 'raised', usage: 'Enlace o novedad' },
]

type Palette = Map<string, string>

/** Extrae `--token: valor` de un trozo de CSS. */
function readTokens(css: string): Palette {
  const palette: Palette = new Map()
  for (const [, name, value] of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    palette.set(name, value.trim())
  }
  return palette
}

/** Devuelve el cuerpo del primer bloque que empieza en `header`, equilibrando llaves. */
function blockAfter(css: string, header: RegExp): string | null {
  const match = header.exec(css)
  if (!match) return null
  const open = css.indexOf('{', match.index + match[0].length - 1)
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  return null
}

function withOverrides(base: Palette, overrides: Palette | null): Palette {
  const merged = new Map(base)
  if (overrides) for (const [k, v] of overrides) merged.set(k, v)
  return merged
}

/** Luminancia relativa de un hex (#rgb o #rrggbb), según WCAG. */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const channels = [0, 2, 4].map((i) => {
    const v = Number.parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  const [hi, lo] = x > y ? [x, y] : [y, x]
  return (hi + 0.05) / (lo + 0.05)
}

const css = readFileSync(TOKENS, 'utf8')

const root = readTokens(blockAfter(css, /^:root\s*\{/m) ?? '')
const dark = readTokens(blockAfter(css, /@media\s*\(prefers-color-scheme:\s*dark\)/) ?? '')
const lightMore = readTokens(
  blockAfter(css, /@media\s*\(prefers-contrast:\s*more\)\s*and\s*\(prefers-color-scheme:\s*light\)/) ?? '',
)
const darkMore = readTokens(
  blockAfter(css, /@media\s*\(prefers-contrast:\s*more\)\s*and\s*\(prefers-color-scheme:\s*dark\)/) ?? '',
)

if (root.size === 0) {
  console.error('No se pudo leer :root de app/assets/css/tokens.css')
  process.exit(2)
}
if (dark.size === 0) {
  console.error('Falta el bloque @media (prefers-color-scheme: dark) en tokens.css')
  process.exit(2)
}
if (lightMore.size === 0 || darkMore.size === 0) {
  console.error(
    'Alto contraste debe declararse por tema: @media (prefers-contrast: more) and (prefers-color-scheme: light|dark).\n'
    + 'Un bloque suelto de prefers-contrast se aplicaría también en oscuro y rompería el contraste.',
  )
  process.exit(2)
}

const light = withOverrides(root, null)
const MODES: ReadonlyArray<{ name: string, palette: Palette }> = [
  { name: 'claro', palette: light },
  { name: 'claro + alto contraste', palette: withOverrides(light, lightMore) },
  { name: 'oscuro', palette: withOverrides(light, dark) },
  { name: 'oscuro + alto contraste', palette: withOverrides(withOverrides(light, dark), darkMore) },
]

let failures = 0

for (const { name, palette } of MODES) {
  console.log(`\n${name}`)
  for (const { fg, bg, usage, min = MIN_RATIO } of PAIRS) {
    const fgHex = palette.get(fg)
    const bgHex = palette.get(bg)
    if (!fgHex || !bgHex) {
      console.error(`  ✖ ${fg} sobre ${bg}: token no definido`)
      failures++
      continue
    }
    const ratio = contrast(fgHex, bgHex)
    const ok = ratio >= min
    if (!ok) failures++
    const mark = ok ? '✔' : '✖'
    const detail = `${fg} (${fgHex}) sobre ${bg} (${bgHex})`
    console.log(`  ${mark} ${ratio.toFixed(2)}:1  ${detail} — ${usage}`)
    if (!ok) {
      console.error(`      falla: necesita ${min}:1. Ajusta el token en tokens.css y actualiza la tabla de sdd/02-diseno.md › Color.`)
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} par(es) por debajo de su mínimo.`)
  process.exit(1)
}

console.log(`\nTodos los pares superan su mínimo (${MIN_RATIO}:1 texto, ${MIN_RATIO_ICON}:1 iconos) en los ${MODES.length} modos.`)
