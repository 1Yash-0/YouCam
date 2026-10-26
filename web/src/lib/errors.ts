export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 500,
    public userMessage?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const ErrorCodes = {
  // YouCam API errors
  INVALID_KEY: 'INVALID_KEY',
  TRYON_FAILED: 'TRYON_FAILED',
  EAR_NOT_VISIBLE: 'EAR_NOT_VISIBLE',
  NECK_NOT_VISIBLE: 'NECK_NOT_VISIBLE',
  PHOTO_DETECTION_FAIL: 'PHOTO_DETECTION_FAIL',
  OBJECT_DETECTION_FAIL: 'OBJECT_DETECTION_FAIL',
  PHOTO_CHECK_INVALID: 'PHOTO_CHECK_INVALID',
  INPUT_ERROR: 'INPUT_ERROR',
  INPUT_MAIN_IMAGE_EMPTY: 'INPUT_MAIN_IMAGE_EMPTY',
  
  // Application errors
  BAD_IMAGE: 'BAD_IMAGE',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  BUDGET_RESERVED: 'BUDGET_RESERVED',
  VISITOR_CAP: 'VISITOR_CAP',
  
  // Pipeline errors
  STACK_TOO_CLOSE: 'STACK_TOO_CLOSE',
  HAIR_FAILED: 'HAIR_FAILED',
  MAKEUP_FAILED: 'MAKEUP_FAILED',
  OUTFIT_FAILED: 'OUTFIT_FAILED',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  ADMIN_DISABLED: 'ADMIN_DISABLED',
} as const

export function mapYouCamError(errorMessage: string): { code: string; userMessage: string } {
  const lower = errorMessage.toLowerCase()
  
  if (lower.includes('earlobe alignment not confident')) {
    return {
      code: ErrorCodes.EAR_NOT_VISIBLE,
      userMessage: 'Turn your head slightly and tuck your hair behind your ear.',
    }
  }
  
  if (lower.includes('photo detection fail')) {
    return {
      code: ErrorCodes.PHOTO_DETECTION_FAIL,
      userMessage: 'No face detected. Please upload a clear photo of your face.',
    }
  }
  
  if (lower.includes('object detection fail')) {
    return {
      code: ErrorCodes.OBJECT_DETECTION_FAIL,
      userMessage: 'Could not detect the earring. Please try a different product image.',
    }
  }
  
  if (lower.includes('photo check invalid')) {
    return {
      code: ErrorCodes.PHOTO_CHECK_INVALID,
      userMessage: 'Photo validation failed. Please upload a different image.',
    }
  }
  
  if (lower.includes('input error')) {
    return {
      code: ErrorCodes.INPUT_ERROR,
      userMessage: 'Invalid input provided.',
    }
  }
  
  if (lower.includes('input main image empty')) {
    return {
      code: ErrorCodes.INPUT_MAIN_IMAGE_EMPTY,
      userMessage: 'Please upload a photo.',
    }
  }
  
  // Default fallback
  return {
    code: ErrorCodes.TRYON_FAILED,
    userMessage: 'Try-on failed. Please try again.',
  }
}