import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let ffmpegLoaded = false

export async function loadFFmpeg() {
  if (ffmpegLoaded && ffmpeg) return ffmpeg
  
  console.log('Loading FFmpeg...')
  ffmpeg = new FFmpeg()
  
  // Set log level to see what's happening
  ffmpeg.on('log', ({ message }) => {
    console.log('FFmpeg:', message)
  })
  
  try {
    // Use the base path directly without toBlobURL
    const baseURL = window.location.origin
    
    await ffmpeg.load({
      coreURL: `${baseURL}/ffmpeg/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg/ffmpeg-core.wasm`,
    })
    
    console.log('FFmpeg loaded successfully')
    ffmpegLoaded = true
    return ffmpeg
  } catch (error) {
    console.error('Failed to load FFmpeg:', error)
    throw error
  }
}

export async function convertGifToMp4(
  gifBlob: Blob, 
  onProgress?: (progress: number) => void
): Promise<Blob> {
  console.log('Starting GIF to MP4 conversion, blob size:', gifBlob.size, 'type:', gifBlob.type)
  const ffmpeg = await loadFFmpeg()
  
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      console.log('FFmpeg progress:', progress)
      onProgress(Math.round(progress * 100))
    })
  }
  
  try {
    // Write the GIF to ffmpeg's file system
    const gifData = await fetchFile(gifBlob)
    console.log('Fetched GIF data, size:', gifData.byteLength)
    await ffmpeg.writeFile('input.gif', gifData)
    
    // Convert GIF to MP4
    // Using libx264 codec with yuv420p pixel format for maximum compatibility
    // -movflags +faststart optimizes for web streaming
    await ffmpeg.exec([
      '-i', 'input.gif',
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure even dimensions
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      'output.mp4'
    ])
    
    // Read the output file
    const outputData = await ffmpeg.readFile('output.mp4')
    console.log('Output MP4 size:', outputData instanceof Uint8Array ? outputData.byteLength : outputData.length)
    
    // Clean up
    await ffmpeg.deleteFile('input.gif')
    await ffmpeg.deleteFile('output.mp4')
    
    // Convert to Blob
    const mp4Blob = new Blob([outputData], { type: 'video/mp4' })
    console.log('Created MP4 blob, size:', mp4Blob.size, 'type:', mp4Blob.type)
    
    return mp4Blob
  } catch (error) {
    console.error('Error converting GIF to MP4:', error)
    throw new Error('Failed to convert GIF to video')
  } finally {
    // Clean up event listener
  }
}

// Utility to check if a file is a GIF
export function isGifFile(file: File | Blob): boolean {
  return file.type === 'image/gif' || 
    (file instanceof File && file.name.toLowerCase().endsWith('.gif'))
}