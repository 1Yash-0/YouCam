import { describe, it, expect, vi, beforeEach } from 'vitest'
import { youcam, getBalance, uploadFile, createEarringTask, getTask } from '@/lib/youcam'

describe('YouCam Client', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getBalance', () => {
    it('should parse balance correctly from API response', async () => {
      const mockResponse = {
        status: 200,
        results: [
          { type: 'ApiPaygToken', amount: 996, expiry: '2027-01-13T23:59:59.000Z' },
          { type: 'ApiPaygToken', amount: 40, expiry: '2027-10-15T23:59:59.000Z' },
          { type: 'OtherToken', amount: 100 }, // Should be ignored
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const balance = await getBalance()
      expect(balance).toBe(1036) // 996 + 40
    })

    it('should throw INVALID_KEY on 401 response', async () => {
      // Create a proper Response-like object
      const mockResponse = {
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: () => Promise.resolve({ error: 'Unauthorized' }),
        text: () => Promise.resolve('{ "error": "Unauthorized" }'),
      } as any
      
      // Mock fetch to always return 401 (not just once) because the code retries on errors
      ;(global.fetch as any).mockResolvedValue(mockResponse)

      await expect(getBalance()).rejects.toThrow('Invalid API key')
    }, 10000) // 10 second timeout for this test
  })

  describe('uploadFile', () => {
    it('should follow upload flow correctly', async () => {
      const mockUploadResponse = {
        status: 200,
        data: {
          files: [{
            file_id: 'test-file-id',
            requests: [{
              method: 'PUT',
              url: 'https://s3.example.com/upload',
              headers: {
                'Content-Type': 'image/png',
                'Content-Length': '12345',
              },
            }],
          }],
        },
      }

      const mockS3Response = {
        ok: true,
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUploadResponse),
        })
        .mockResolvedValueOnce(mockS3Response)

      const testBuffer = Buffer.from('test image data')
      const fileId = await uploadFile(testBuffer, 'image/png', 'test.png')

      expect(fileId).toBe('test-file-id')
      
      // Check that first call was to YouCam API
      expect(global.fetch).toHaveBeenNthCalledWith(1, 
        'https://test-api.example.com/s2s/v2.0/file',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        })
      )

      // Check that second call was to S3 without Authorization header
      expect(global.fetch).toHaveBeenNthCalledWith(2,
        'https://s3.example.com/upload',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': '12345',
          },
          body: testBuffer,
        })
      )
    })
  })

  describe('createEarringTask', () => {
    it('should build correct request body', async () => {
      const mockResponse = {
        status: 200,
        data: { task_id: 'test-task-id' },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const taskId = await createEarringTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
        scaleCm: 3.0,
        rightEar: true,
        occluded: 0,
      })

      expect(taskId).toBe('test-task-id')
      
      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      expect(body).toEqual({
        src_file_id: 'src-file-id',
        ref_file_ids: ['ref-file-id'],
        source_info: { name: 'face' },
        object_infos: [{
          name: 'gen_earring.png',
          parameter: {
            earring_need_remove_background: true,
            earring_scale: 3.0,
            earring_is_right_ear: true,
            earring_occluded_type: 0,
            earring_shadow_intensity: 0.5,
            earring_ambient_light_intensity: 0.5,
          },
        }],
      })
    })

    it('should include optional fields when provided', async () => {
      const mockResponse = {
        status: 200,
        data: { task_id: 'test-task-id' },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await createEarringTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
        scaleCm: 4.5,
        rightEar: false,
        occluded: 1,
        wearingLocation: [100, 200],
        anchorPoint: [50, 75],
      })

      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      expect(body.object_infos[0].parameter.earring_wearing_location).toEqual([100, 200])
      expect(body.object_infos[0].parameter.earring_anchor_point).toEqual([[50, 75]])
    })

    it('should omit optional fields when undefined', async () => {
      const mockResponse = {
        status: 200,
        data: { task_id: 'test-task-id' },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await createEarringTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
        scaleCm: 3.0,
        rightEar: true,
        occluded: 0,
      })

      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      expect(body.object_infos[0].parameter.earring_wearing_location).toBeUndefined()
      expect(body.object_infos[0].parameter.earring_anchor_point).toBeUndefined()
    })
  })

  describe('getTask', () => {
    it('should parse task status with various URL formats', async () => {
      const testCases = [
        {
          response: {
            status: 200,
            data: {
              task_status: 'success',
              results: { url: 'https://result-url-1.png' },
            },
          },
          expectedUrl: 'https://result-url-1.png',
        },
        {
          response: {
            status: 200,
            data: {
              task_status: 'success',
              results: [{ url: 'https://result-url-2.png' }],
            },
          },
          expectedUrl: 'https://result-url-2.png',
        },
        {
          response: {
            status: 200,
            data: {
              task_status: 'success',
              results: [{ download_url: 'https://result-url-3.png' }],
            },
          },
          expectedUrl: 'https://result-url-3.png',
        },
      ]

      for (const testCase of testCases) {
        vi.resetAllMocks()
        ;(global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testCase.response),
        })

        const result = await getTask('2d-vto/earring', 'test-task-id')
        expect(result.status).toBe('success')
        expect(result.resultUrl).toBe(testCase.expectedUrl)
      }
    })

    it('should handle error status', async () => {
      const mockResponse = {
        status: 200,
        data: {
          task_status: 'error',
          error: {
            message: 'earlobe alignment not confident',
            error_code: 2,
          },
        },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await getTask('2d-vto/earring', 'test-task-id')
      expect(result.status).toBe('error')
      expect(result.errorMessage).toBe('earlobe alignment not confident')
    })
  })

  describe('rate limiting', () => {
    it('should retry on 429 with exponential backoff', async () => {
      const successResponse = {
        status: 200,
        results: [{ type: 'ApiPaygToken', amount: 1000 }],
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          status: 429,
          ok: false,
          json: () => Promise.resolve({ error: 'Rate limited' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(successResponse),
        })

      const balance = await getBalance()
      expect(balance).toBe(1000)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})