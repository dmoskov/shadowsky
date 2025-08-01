/**
 * Compress and resize images to meet Bluesky's requirements
 */

const MAX_DIMENSION = 2000 // Bluesky's max dimension
const MAX_FILE_SIZE = 1000000 // 1MB (Bluesky's limit)
const COMPRESSION_STEP = 0.05 // Reduce quality by 5% each iteration

export async function compressImage(file: File): Promise<File> {
  // If file is already under the limit, return as-is
  if (file.size <= MAX_FILE_SIZE) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = async () => {
        try {
          // Calculate new dimensions if needed
          let { width, height } = img
          
          // Scale down if dimensions exceed max
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
            // Calculate exact dimensions maintaining aspect ratio
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
            
          }
          
          // Create canvas for compression
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }
          
          canvas.width = width
          canvas.height = height
          
          // Disable image smoothing to prevent border artifacts
          ctx.imageSmoothingEnabled = false
          
          // Draw the image scaled to fit exactly
          ctx.drawImage(img, 0, 0, width, height)
          
          // Try different quality levels until we're under the size limit
          let quality = 0.9
          let blob: Blob | null = null
          const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
          
          while (quality > 0.1) {
            blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(
                (b) => resolve(b),
                outputFormat,
                quality
              )
            })
            
            if (!blob) {
              break
            }
            
            if (blob.size <= MAX_FILE_SIZE) {
              break
            }
            
            quality -= COMPRESSION_STEP
          }
          
          if (!blob || blob.size > MAX_FILE_SIZE) {
            // If we still can't get under the limit, try more aggressive compression
            // Convert PNG to JPEG for better compression
            blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(
                (b) => resolve(b),
                'image/jpeg',
                0.7
              )
            })
          }
          
          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }
          
          // Create a new File from the blob
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.(png|PNG)$/, '.jpg'), // Convert PNG filenames to JPG
            { type: blob.type }
          )
          
          console.log(`Compressed image from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
          
          resolve(compressedFile)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function isCompressibleImage(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png' || file.type === 'image/webp'
}