import type { News } from './types'

/**
 * Novedades (F7-T04): noticias publicadas desde la última vez que se abrió la
 * sección. `lastSeen` es un instante ISO; sin él (primera vez) no se avisa de nada,
 * para no recibir a nadie con un punto por noticias de hace años.
 */
export function unseenCount(news: Pick<News, 'created_on'>[], lastSeen: string | null): number {
  if (!lastSeen) return 0
  return news.filter(item => item.created_on > lastSeen).length
}

/** Primer párrafo de una noticia para la lista: el resumen o el arranque del texto. */
export function newsExcerpt(item: Pick<News, 'summary' | 'description'>, max = 180): string {
  const text = (item.summary?.trim() || item.description?.trim() || '').replace(/\s+/g, ' ')
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
