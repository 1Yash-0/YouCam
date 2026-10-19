import { Product } from '@/lib/products'

export type DrawerStep = 'photo' | 'measure' | 'processing' | 'result' | 'bag' | 'error'

export type EarOption = 'auto' | 'left' | 'right'

export type CompareMode = 'original' | 'earring-only'

export interface MeasurementBox {
  x: number
  y: number
  w: number
  h: number
  pixels: number
}

export interface MeasurementData {
  box: MeasurementBox
  renderedPx: number
  renderedCm: number
  errorPct: number
  withinTolerance: boolean
  tolerancePct: number
}

export interface StylingExtras {
  lipstick?: {
    id: string
    name: string
    hex: string
    texture: 'matte' | 'satin' | 'gloss' | 'shimmer'
    intensity: number
  }
  hairUp?: {
    templateId: string
    title: string
  }
  outfit?: {
    productId: string
    title: string
  }
  stack?: Array<{
    productId: string
    sizeCm: number
    wearingLocation: [number, number]
  }>
}

export interface TryOnErrorState {
  code: string
  userMessage: string
  step?: string
  recoveryAction?: 'sample' | 'retry' | 'reupload' | 'ear'
}

export interface TryOnState {
  isOpen: boolean
  step: DrawerStep
  previousStep: DrawerStep | null
  productId: string
  sizeCm: number
  photoId: string | null
  photoUrl: string | null
  photoDimensions: { width: number; height: number } | null
  isSampleFace: boolean
  irisPx: number
  irisMm: number
  ear: EarOption
  zoom: number
  caliperCoords: { x: number; y: number }
  jobId: string | null
  activeSteps: Array<'cloth' | 'hair' | 'makeup' | 'earring' | 'stack' | 'necklace'>
  stepIndex: number
  totalSteps: number
  currentStepName: string
  hairlineProgress: number
  resultKey: string | null
  resultImageUrl: string | null
  baseResultImageUrl: string | null // original earring-only result before extras
  renderedCm: number | null
  tolerancePct: number
  withinTolerance: boolean | null
  showRuler: boolean
  compareMode: CompareMode
  splitPosition: number
  measurement: MeasurementData | null
  extras: StylingExtras
  isPresetRendering: boolean
  cachedPresets: Set<string>
  error: TryOnErrorState | null
}

export interface TryOnDrawerProps {
  isOpen: boolean
  onClose: () => void
  product: Product
  initialSizeCm?: number
}

export interface DrawerHeaderProps {
  product: Product
  selectedSizeCm: number
  onSizeChange: (size: number) => void
  currentStep: DrawerStep
  onClose: () => void
  availableSizes?: number[]
}

export interface PhotoStepProps {
  onSelectSample: () => void
  onUploadFile: (file: File) => Promise<void>
  isUploading: boolean
  error?: string | null
}

export interface MeasureStepProps {
  photoUrl: string
  isSampleFace: boolean
  irisPx: number
  onIrisChange: (px: number) => void
  onResetAverage: () => void
  ear: EarOption
  onEarChange: (ear: EarOption) => void
  selectedSizeCm: number
  onSubmitTryOn: () => void
  isSubmitting: boolean
  caliperCoords: { x: number; y: number }
  onCaliperCoordsChange: (coords: { x: number; y: number }) => void
}

export interface ProcessingStepProps {
  steps: Array<'cloth' | 'hair' | 'makeup' | 'earring' | 'stack' | 'necklace'>
  currentStepIndex: number
  totalSteps: number
  progress: number
  currentCopy: string
  userPhotoUrl?: string | null
}

export interface MeasuringRulerOverlayProps {
  box: MeasurementBox
  renderedCm: number
  targetSizeCm?: number
  caliperDrawn: boolean
  displayedCm: number
  naturalWidth?: number
  naturalHeight?: number
}

export interface SplitSliderProps {
  beforeImageUrl: string
  afterImageUrl: string
  measurement?: MeasurementData | null
  targetSizeCm: number
  showRuler: boolean
  sliderPosition: number
  onSliderPositionChange: (pos: number) => void
  caliperDrawn: boolean
  displayedCm: number
}

export interface CompleteTheLookProps {
  extras: StylingExtras
  onToggleLipstick: () => void
  onToggleHairUp: () => void
  onToggleOutfit: () => void
  onToggleStack: () => void
  isRendering: boolean
  cachedPresets: Set<string>
  onSelectLipstickShade?: (shade: { id: string; name: string; hex: string; texture: 'matte' | 'satin' | 'gloss' | 'shimmer'; intensity: number }) => void
}

export interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export interface ErrorCardProps {
  error: TryOnErrorState
  photoUrl?: string | null
  onUseSampleFace: () => void
  onRetry: () => void
  onReupload: () => void
  onSwitchEar: () => void
}

export interface ResultStepProps {
  state: TryOnState
  product: Product
  onToggleRuler: () => void
  onSetCompareMode: (mode: CompareMode) => void
  onSliderPositionChange: (pos: number) => void
  onToggleLipstick: () => void
  onToggleHairUp: () => void
  onToggleOutfit: () => void
  onToggleStack: () => void
  onSelectLipstickShade: (shade: { id: string; name: string; hex: string; texture: 'matte' | 'satin' | 'gloss' | 'shimmer'; intensity: number }) => void
  onAddToCart: () => void
  onRecalibrate: () => void
}
