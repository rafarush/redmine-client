import { RuleTester } from 'eslint'
// @ts-expect-error -- regla propia en JS sin tipos
import rule from '../../eslint-rules/no-raw-hex-color.mjs'

const ruleTester = new RuleTester()

ruleTester.run('design/no-raw-hex-color', rule, {
  valid: [
    // Un id de tarea no es un color: 4 dígitos no forman hex válido.
    { code: 'const etiqueta = "#4821"' },
    { code: 'const ancla = "#top"' },
    { code: 'const color = "var(--accent)"' },
    { code: 'const clase = "bg-accent text-on-accent"' },
    // 5 y 7 dígitos tampoco son colores.
    { code: 'const x = "#12345"' },
    { code: 'const y = "#1234567"' },
  ],
  invalid: [
    { code: 'const c = "#ff0000"', errors: [{ messageId: 'rawHex' }] },
    { code: 'const c = "#abc"', errors: [{ messageId: 'rawHex' }] },
    { code: 'const c = "#11223344"', errors: [{ messageId: 'rawHex' }] },
    // Valor arbitrario de Tailwind dentro de una clase.
    { code: 'const c = "bg-[#1a2b3c]"', errors: [{ messageId: 'rawHex' }] },
    { code: 'const a = "#fff", b = "#000"', errors: [{ messageId: 'rawHex' }, { messageId: 'rawHex' }] },
  ],
})
