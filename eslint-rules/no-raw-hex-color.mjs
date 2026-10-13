/**
 * Prohíbe colores hexadecimales escritos a mano fuera de `app/assets/css/tokens.css`.
 *
 * Regla de `sdd/02-diseno.md`: todo color sale de un token, para que claro, oscuro y
 * alto contraste sigan funcionando y los contrastes medidos sigan siendo ciertos.
 *
 * Escanea el texto del archivo, así que también ve los bloques `<style>` de un SFC,
 * los valores arbitrarios de Tailwind (`bg-[#fff]`) y los `style` en línea.
 *
 * Solo reconoce hex de 3, 6 u 8 dígitos para no confundir un id de tarea (`#4821`)
 * con un color. Si una línea necesita la excepción:
 * `// eslint-disable-next-line design/no-raw-hex-color -- motivo`
 */
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g

/** Posición (línea/columna, base 1/0) de un índice del texto, sin depender de la API del lenguaje. */
function locAt(text, index) {
  let line = 1
  let lineStart = 0
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      line++
      lineStart = i + 1
    }
  }
  return { line, column: index - lineStart }
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Usa tokens de color en vez de hexadecimales sueltos' },
    schema: [],
    messages: {
      rawHex:
        'No escribas el color {{hex}} aquí. Usa un token de app/assets/css/tokens.css (por ejemplo bg-surface, text-secondary, bg-accent). Ver sdd/02-diseno.md.',
    },
  },

  create(context) {
    const report = () => {
      const text = context.sourceCode.getText()
      for (const match of text.matchAll(HEX)) {
        const start = locAt(text, match.index)
        context.report({
          loc: { start, end: locAt(text, match.index + match[0].length) },
          messageId: 'rawHex',
          data: { hex: match[0] },
        })
      }
    }

    // `Program` cubre JS, TS y SFC de Vue; `StyleSheet`, los archivos .css.
    return { Program: report, StyleSheet: report }
  },
}
