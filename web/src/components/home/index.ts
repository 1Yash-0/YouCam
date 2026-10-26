export { Preloader, PRELOADER_SESSION_KEY } from './Preloader'
export type { PreloaderProps } from './Preloader'

export {
  HeroScrub,
  HERO_FRAMES,
  HERO_STOP_PROGRESS,
  HERO_CAPTIONS,
  HERO_REDUCED_MOTION_GRID,
  getNearestHeroFrameIndex,
  getHeroSizeForProgress,
  getReducedMotionGridItems,
} from './HeroScrub'
export type { HeroFrame } from './HeroScrub'
export { HeroRuler, RULER_WINDOWS } from './HeroRuler'

export { IrisNarrative } from './IrisNarrative'
export type { IrisNarrativeProps } from './IrisNarrative'

export { CategoryRail, CATEGORIES, CategorySilhouette } from './CategoryRail'
export type { CategoryRailProps, CategoryItem } from './CategoryRail'

export { AtelierMarquee, DEFAULT_MARQUEE_ITEMS } from './AtelierMarquee'
export type { AtelierMarqueeProps, MarqueeItem } from './AtelierMarquee'

export { CategoryChips, type ProductCategory } from './CategoryChips'
export type { CategoryChipsProps } from './CategoryChips'

export { FloatingCursor } from './FloatingCursor'
export type { FloatingCursorProps } from './FloatingCursor'

export { LookClient, LOOK_CAPTIONS, getLookCaption } from './LookClient'
export type { LookClientProps } from './LookClient'

export { ProductCard, WORN_IMAGE_MAP, getWornImageUrl, getProductMeta, getProductSourceCredit, getProductBadgeLabel } from './ProductCard'
export { formatPrice } from '@/lib/format'
export type { ProductCardProps } from './ProductCard'

export { ProductGrid, filterProducts, sortProducts, getAvailableCategories, GRID_CATEGORIES, COLLECTION_CATEGORIES } from './ProductGrid'
export type { ProductGridProps } from './ProductGrid'

export { Footer } from './Footer'
