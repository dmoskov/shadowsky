import { BskyAgent } from '@atproto/api'

export interface VideoUploadResult {
  blob: {
    ref: { $link: string }
    mimeType: string
    size: number
  }
  aspectRatio?: {
    width: number
    height: number
  }
}

export class VideoUploadService {
  private agent: BskyAgent

  constructor(agent: BskyAgent) {
    this.agent = agent
  }

  async uploadVideo(
    videoData: Uint8Array, 
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<VideoUploadResult> {
    try {
      // Get service auth token
      const serviceAuth = await this.agent.com.atproto.server.getServiceAuth({
        aud: 'did:web:video.bsky.app',
      })

      // Upload video
      const uploadUrl = 'https://video.bsky.app/xrpc/app.bsky.video.uploadVideo'
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceAuth.data.token}`,
          'Content-Type': mimeType,
          'Content-Length': videoData.length.toString(),
        },
        body: videoData,
      })

      if (!uploadResponse.ok) {
        throw new Error(`Video upload failed: ${uploadResponse.statusText}`)
      }

      const uploadResult = await uploadResponse.json()
      const jobId = uploadResult.jobId

      // Poll for job status
      let jobStatus
      let attempts = 0
      const maxAttempts = 60 // 60 seconds timeout
      
      while (attempts < maxAttempts) {
        const statusResponse = await this.agent.app.bsky.video.getJobStatus({ jobId })
        jobStatus = statusResponse.data.jobStatus
        
        if (jobStatus.state === 'JOB_STATE_COMPLETED' && jobStatus.blob) {
          return {
            blob: jobStatus.blob
          }
        } else if (jobStatus.state === 'JOB_STATE_FAILED') {
          throw new Error(`Video processing failed: ${jobStatus.error || 'Unknown error'}`)
        }
        
        // Update progress if callback provided
        if (onProgress && jobStatus.progress) {
          onProgress(jobStatus.progress)
        }
        
        // Wait 1 second before next poll
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }
      
      throw new Error('Video processing timeout')
    } catch (error) {
      console.error('Video upload error:', error)
      throw error
    }
  }
}