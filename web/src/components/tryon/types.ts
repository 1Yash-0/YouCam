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
  naturalWidth?: number
  naturalHeight?: number
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
  finger: 1 | 2 | 3 | 4 | 5
  ringSizeUs: number
  ringSizeKnown: boolean
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
  activeSteps: Array<'cloth' | 'hair' | 'makeup' | 'earring' | 'stack' | 'necklace' | 'ring' | 'watch' | 'bracelet'>
  stepIndex: number
  totalSteps: number
  currentStepName: string
  hairlineProgress: number
  resultKey: string | null
  resultImageUrl: string | null
  baseResultImageUrl: string | null // original earring-only result before extras
  baseMeasurement: MeasurementData | null
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
  product?: Product
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
  currentStepName?: string
  steps: Array<'cloth' | 'hair' | 'makeup' | 'earring' | 'stack' | 'necklace' | 'ring' | 'watch' | 'bracelet'>
  currentStepIndex: number
  totalSteps: number
  progress: number
  currentCopy: string
  userPhotoUrl?: string | null
  /** Stop waiting for this render. The unit for an already-submitted render is still used. */
  onCancel?: () => void
}

export interface MeasuringRulerOverlayProps {
  box: MeasurementBox
  renderedCm: number
  targetSizeCm?: number
  caliperDrawn: boolean
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
  className?: string
}

export interface CompleteTheLookProps {
  basicOnly?: boolean
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
  sizeComparisons?: Array<{ sizeCm: number; imageUrl: string; measurement?: MeasurementData | null }>
  onCompareSize?: (size: number) => void
  isComparingSize?: boolean
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
  onApplyStyling?: (extras: StylingExtras) => void
  onClearStyling?: () => void
  hairTemplates?: Array<{ templateId: string; title: string }>
  isLoadingHairTemplates?: boolean
  onRequestHairTemplates?: () => void
  onAddToCart: () => void
  onRecalibrate: () => void
}
