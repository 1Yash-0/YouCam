import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { normalisePhoto } from '@/lib/images'
import { sha256 } from '@/lib/hash'
import { uploadFile } from '@/lib/youcam'
import { putFile, putJson, photoMetaPath, getJson } from '@/lib/storage'
import { AppError, ErrorCodes } from '@/lib/errors'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB

const uploadSchema = z.object({
  photo: z.instanceof(File).refine(
    file => file.size <= MAX_FILE_SIZE,
    `File must be less than ${MAX_FILE_SIZE / 1024 / 1024} MB`
  ),
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('photo') as File | null
    
    if (!file) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        'No photo file provided',
        400,
        'Please upload a photo.'
      )
    }
    
    // Validate file
    uploadSchema.parse({ photo: file })
    
    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Normalise photo
    const normalised = await normalisePhoto(buffer)
    
    // Generate hash
    const photoHash = sha256(normalised.png)
    
    // Check if we already have metadata and it's recent (< 25 days)
    const existingMeta = await getJson<{
      fileId: string
      uploadedAt: string
      width: number
      height: number
    }>(photoMetaPath(photoHash))
    
    let fileId: string
    
    if (existingMeta && existingMeta.uploadedAt) {
      const uploadedDate = new Date(existingMeta.uploadedAt)
      const now = new Date()
      const daysSinceUpload = (now.getTime() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysSinceUpload < 25) {
        // Reuse existing fileId
        fileId = existingMeta.fileId
      } else {
        // Need to re-upload
        fileId = await uploadFile(normalised.png, 'image/png', 'photo.png')
      }
    } else {
      // First time upload
      fileId = await uploadFile(normalised.png, 'image/png', 'photo.png')
    }
    
    // Save normalised photo locally
    await putFile(`photos/${photoHash}.png`, normalised.png)
    
    // Save metadata
    const meta = {
      fileId,
      uploadedAt: new Date().toISOString(),
      width: normalised.width,
      height: normalised.height,
    }
    
    await putJson(photoMetaPath(photoHash), meta)
    
    return NextResponse.json({
      photoId: photoHash,
      width: normalised.width,
      height: normalised.height,
    })
    
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({
        code: error.code,
        userMessage: error.userMessage || error.message,
      }, { status: error.httpStatus })
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        code: ErrorCodes.INVALID_INPUT,
        userMessage: error.errors[0]?.message || 'Invalid input',
      }, { status: 400 })
    }
    
    console.error('Photo upload error:', error)
    return NextResponse.json({
      code: ErrorCodes.INTERNAL_ERROR,
      userMessage: 'Failed to process photo.',
    }, { status: 500 })
  }
}