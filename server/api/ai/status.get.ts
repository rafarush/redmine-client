/** ¿Hay clave de la API de Anthropic? Solo dice si hay y de dónde; nunca la clave (F12). */
export default defineEventHandler(async (event) => {
  const found = await anthropicKey(event)
  return { hasKey: found !== null, source: found?.source ?? null }
})
