import sharp from 'sharp'
import { AppError, ErrorCodes } from './errors'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_LONG_SIDE = 2048 // We'll use 2048 instead of 4096 for better performance

export interface ImageDimensions {
  width: number
  height: number
}

export interface NormalisedImage {
  png: Buffer
  width: number
  height: number
}

export async function dimensions(buf: Buffer): Promise<ImageDimensions> {
  const metadata = await sharp(buf).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  }
}

export async function normalisePhoto(buf: Buffer): Promise<NormalisedImage> {
  // Check file size
  if (buf.length > MAX_FILE_SIZE) {
    throw new AppError(
      ErrorCodes.BAD_IMAGE,
      `Image is too large (${(buf.length / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.`,
      400,
      'Image is too large. Please upload an image smaller than 10 MB.'
    )
  }

  try {
    // Get metadata to check format
    const metadata = await sharp(buf).metadata()
    
    // Check if it's a supported format
    if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw new AppError(
        ErrorCodes.BAD_IMAGE,
        `Unsupported image format: ${metadata.format || 'unknown'}`,
        400,
        'Please upload a JPG, PNG, or WebP image.'
      )
    }

    // Auto-rotate by EXIF, resize if needed (never upscale)
    const { width = 0, height = 0 } = metadata
    const longSide = Math.max(width, height)
    
    let pipeline = sharp(buf).rotate() // Auto-rotate by EXIF
    
    if (longSide > MAX_LONG_SIDE) {
      const scale = MAX_LONG_SIDE / longSide
      const newWidth = Math.round(width * scale)
      const newHeight = Math.round(height * scale)
      
      pipeline = pipeline.resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    // Convert to PNG
    const pngBuffer = await pipeline.png().toBuffer()
    const finalMetadata = await sharp(pngBuffer).metadata()
    
    return {
      png: pngBuffer,
      width: finalMetadata.width || width,
      height: finalMetadata.height || height,
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    
    throw new AppError(
      ErrorCodes.BAD_IMAGE,
      `Failed to process image: ${error instanceof Error ? error.message : String(error)}`,
      400,
      'Invalid image file. Please upload a valid JPG, PNG, or WebP image.'
    )
  }
}