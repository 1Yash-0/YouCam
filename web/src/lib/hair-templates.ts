export type HairStyleTemplate = {
  id: string
  title: string
  thumb: string
  keepsColour: boolean
}

const STYLE_WORDS = /\b(?:bun|braids?|updo|up-do)\b/i

export function normalizeHairTemplates(input: unknown): HairStyleTemplate[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((value): HairStyleTemplate[] => {
    if (!value || typeof value !== 'object') return []
    const item = value as Record<string, unknown>
    const id = typeof item.id === 'string' ? item.id : typeof item.template_id === 'string' ? item.template_id : ''
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const thumb = typeof item.thumb === 'string' ? item.thumb : typeof item.cover === 'string' ? item.cover : ''
    if (!id || !title || !STYLE_WORDS.test(`${id} ${title}`)) return []

    const colour = item.keepsColour ?? item.keep_users_color ?? item.supports_hair_color
    return [{ id, title, thumb, keepsColour: colour === true }]
  })
}

export function isFreshHairTemplateCache(value: unknown, now = Date.now()): value is { fetchedAt: number; templates: HairStyleTemplate[] } {
  if (!value || typeof value !== 'object') return false
  const cache = value as { fetchedAt?: unknown; templates?: unknown }
  return typeof cache.fetchedAt === 'number'
    && now - cache.fetchedAt >= 0
    && now - cache.fetchedAt < 24 * 60 * 60 * 1000
    && Array.isArray(cache.templates)
    && cache.templates.every(template => {
      if (!template || typeof template !== 'object') return false
      const item = template as Partial<HairStyleTemplate>
      return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.thumb === 'string' && typeof item.keepsColour === 'boolean'
    })
}
