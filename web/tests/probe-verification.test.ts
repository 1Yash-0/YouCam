import { describe, it, expect, vi, beforeEach } from 'vitest'
import { youcam, createTask, createEarringTask, createEarringStackTask, createNecklaceTask, createMakeupTask, createClothTask, createHairTask, createSkinToneTask, createTextToImageTask, YouCamFeature, YOUCAM_ENDPOINTS } from '@/lib/youcam'

describe('Probe Body Verification', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Mock fetch for all tests
  const mockTaskResponse = (taskId: string = 'test-task-id') => ({
    status: 200,
    data: { task_id: taskId },
  })

  describe('2d-vto/earring (single)', () => {
    it('should build body matching probe P7 chaining structure', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskResponse()),
      })

      const taskId = await createEarringTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
        scaleCm: 3.0,
        rightEar: true,
        occluded: 0,
        wearingLocation: [375, 660],
      })

      expect(taskId).toBe('test-task-id')
      
      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      // Verify structure matches probe P7
      expect(body).toEqual({
        src_file_id: 'src-file-id',
        ref_file_ids: ['ref-file-id'],
        source_info: { name: 'face' },
        object_infos: [{
          name: 'gen_earring.png',
          parameter: {
            earring_need_remove_background: true,
            earring_wearing_location: [375, 660],
            earring_scale: 3.0,
            earring_is_right_ear: true,
            earring_occluded_type: 0,
            earring_shadow_intensity: 0.5,
            earring_ambient_light_intensity: 0.5,
          },
        }],
      })
    })
  })

  describe('2d-vto/earring (stack)', () => {
    it('should build body matching probe P1 ear stack structure', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskResponse()),
      })

      const taskId = await createEarringStackTask({
        src: { fileId: 'src-file-id' },
        refs: [{ fileId: 'ref1-id' }, { fileId: 'ref2-id' }],
        placements: [
          { scaleCm: 1.0, wearingLocation: [375, 660] },
          { scaleCm: 2.0, wearingLocation: [372, 620] },
        ],
        rightEar: true,
        occluded: 0,
      })

      expect(taskId).toBe('test-task-id')
      
      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      // Verify structure matches probe P1
      expect(body).toEqual({
        src_file_id: 'src-file-id',
        ref_file_ids: ['ref1-id', 'ref2-id'],
        source_info: { name: 'gen_face.png' },
        object_infos: [
          {
            name: 'gen_earring.png',
            parameter: {
              earring_need_remove_background: true,
              earring_wearing_location: [375, 660],
              earring_scale: 1.0,
              earring_is_right_ear: true,
              earring_occluded_type: 0,
              earring_shadow_intensity: 0.5,
              earring_ambient_light_intensity: 0.5,
            },
          },
          {
            name: 'gen_earring.png',
            parameter: {
              earring_need_remove_background: true,
              earring_wearing_location: [372, 620],
              earring_scale: 2.0,
              earring_is_right_ear: true,
              earring_occluded_type: 0,
              earring_shadow_intensity: 0.5,
              earring_ambient_light_intensity: 0.5,
            },
          },
        ],
      })
    })
  })

  describe('2d-vto/necklace', () => {
    it('should build correct necklace request body', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskResponse()),
      })

      const taskId = await createNecklaceTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
      })

      expect(taskId).toBe('test-task-id')
      
      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      expect(body).toEqual({
        src_file_id: 'src-file-id',
        ref_file_ids: ['ref-file-id'],
        source_info: { name: 'gen_face.png' },
        object_infos: [{
          name: 'gen_necklace.png',
          parameter: {
            necklace_need_remove_background: true,
            necklace_shadow_intensity: 0.5,
            necklace_ambient_light_intensity: 0.5,
          },
        }],
      })
    })
  })

  describe('makeup-vto', () => {
    it('should build body matching probe P3 lipstick structure', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskResponse()),
      })

      const taskId = await createMakeupTask({
        src: { fileId: 'src-file-id' },
        lip: {
          hex: '#9B1B30',
          texture: 'matte' as const,
          intensity: 70,
        },
      })

      expect(taskId).toBe('test-task-id')
      
      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      // Match P3 probe structure
      expect(body).toEqual({
        src_file_id: 'src-file-id',
        version: '1.0',
        effects: [
          {
            category: 'skin_smooth',
            skinSmoothStrength: 0,
            skinSmoothColorIntensity: 0,
          },
          {
            category: 'lip_color',
            shape: { name: 'original' },
            morphology: { fullness: 50, wrinkless: 50 },
            palettes: [{
              color: '#9B1B30',
              texture: 'matte',
              colorIntensity: 70,
            }],
            style: { type: 'full' },
          },
        ],
      })
    })
  })

  describe('cloth-v4', () => {
    it('should build body matching probe P6 clothes v4 structure', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTaskResponse()),
      })

      const taskId = await createClothTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
        garmentCategory: 'upper_body',
      })

      expect(taskId).toBe('test-task-id')
      
      const call = (global.fetch as any).mock.calls[0]
      const body = JSON.parse(call[1].body)
      
      // Match P6 probe structure
      expect(body).toEqual({
        src_file_id: 'src-file-id',
        ref_file_id: 'ref-file-id',
        garment_category: 'upper_body',
      })
    })
  })

  describe('Generic createTask/getTask', () => {
    it('should work with generic createTask for all features', async () => {
      const testCases: Array<{
        feature: YouCamFeature
        body: any
        expectedEndpoint: string
      }> = [
        {
          feature: '2d-vto/earring',
          body: {
            src_file_id: 'test-src',
            ref_file_ids: ['test-ref'],
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
          },
          expectedEndpoint: '/s2s/v2.0/task/2d-vto/earring',
        },
        {
          feature: 'makeup-vto',
          body: {
            src_file_id: 'test-src',
            version: '1.0',
            effects: [{
              category: 'lip_color',
              shape: { name: 'original' },
              morphology: { fullness: 50, wrinkless: 50 },
              palettes: [{ color: '#9B1B30', texture: 'matte', colorIntensity: 70 }],
              style: { type: 'full' },
            }],
          },
          expectedEndpoint: '/s2s/v2.0/task/makeup-vto',
        },
        {
          feature: 'cloth-v4',
          body: {
            src_file_id: 'test-src',
            ref_file_id: 'test-ref',
            garment_category: 'upper_body',
          },
          expectedEndpoint: '/s2s/v2.0/task/cloth-v4',
        },
      ]

      for (const testCase of testCases) {
        vi.resetAllMocks()
        ;(global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTaskResponse()),
        })

        const taskId = await createTask(testCase.feature, testCase.body)
        expect(taskId).toBe('test-task-id')
        
        const call = (global.fetch as any).mock.calls[0]
        const endpoint = call[0]
        expect(endpoint).toContain(testCase.expectedEndpoint)
      }
    })

    it('maps every feature to its exact verified endpoint for create and poll', async () => {
      for (const feature of Object.keys(YOUCAM_ENDPOINTS) as YouCamFeature[]) {
        vi.resetAllMocks()
        ;(global.fetch as any)
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockTaskResponse()) })
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 200, data: { task_status: 'running' } }) })
        await createTask(feature, { src_file_id: 'src' } as any)
        await youcam.getTask(feature, 'task')
        expect((global.fetch as any).mock.calls[0][0]).toContain(YOUCAM_ENDPOINTS[feature])
        expect((global.fetch as any).mock.calls[1][0]).toContain(`${YOUCAM_ENDPOINTS[feature]}/task`)
      }
    })

    it('should validate inputs in typed builders', async () => {
      // Test validation in createEarringTask
      await expect(createEarringTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
        scaleCm: 0.1, // Invalid: below 0.3
        rightEar: true,
        occluded: 0,
      })).rejects.toThrow('scaleCm must be between 0.3 and 15')

      await expect(createEarringTask({
        src: { fileId: 'src-file-id' },
        ref: { fileId: 'ref-file-id' },
        scaleCm: 20, // Invalid: above 15
        rightEar: true,
        occluded: 0,
      })).rejects.toThrow('scaleCm must be between 0.3 and 15')
    })
  })
})