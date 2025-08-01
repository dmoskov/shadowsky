import React, { useState } from 'react'

interface CompressionResult {
  name: string
  blob: Blob
  url: string
  size: number
  time: number
}

export function CompressionTest() {
  const [results, setResults] = useState<CompressionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [originalFile, setOriginalFile] = useState<File | null>(null)

  const compressionMethods = [
    {
      name: 'Original (no compression)',
      compress: async (file: File) => file
    },
    {
      name: 'Simple scale',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'With white background',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              
              // Fill white background
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, 0, width, height)
              
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'No smoothing',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'High quality smoothing',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'Clear rect first',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.clearRect(0, 0, width, height)
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'Precise source dimensions',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'No alpha context',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d', { alpha: false })!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'Floor dimensions',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.floor(width * ratio)
                height = Math.floor(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9)
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    },
    {
      name: 'PNG output',
      compress: async (file: File) => {
        return new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              
              let { width, height } = img
              if (width > 2000 || height > 2000) {
                const ratio = Math.min(2000 / width, 2000 / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
              }
              
              canvas.width = width
              canvas.height = height
              ctx.drawImage(img, 0, 0, width, height)
              
              canvas.toBlob((blob) => resolve(blob!), 'image/png')
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      }
    }
  ]

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOriginalFile(file)
    setLoading(true)
    setResults([])

    const newResults: CompressionResult[] = []

    for (const method of compressionMethods) {
      try {
        const start = Date.now()
        const result = await method.compress(file)
        const time = Date.now() - start
        
        const url = URL.createObjectURL(result)
        
        newResults.push({
          name: method.name,
          blob: result,
          url,
          size: result.size,
          time
        })
      } catch (error) {
        console.error(`Failed ${method.name}:`, error)
      }
    }

    setResults(newResults)
    setLoading(false)
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Image Compression Test</h1>
      
      <div className="mb-6">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="mb-4"
        />
        
        {originalFile && (
          <div className="text-sm text-gray-600">
            Original file: {originalFile.name} ({(originalFile.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}
      </div>

      {loading && <div className="text-lg">Processing compression methods...</div>}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((result, i) => (
            <div key={i} className="border p-4 rounded">
              <h3 className="font-bold mb-2">{result.name}</h3>
              <div className="text-sm text-gray-600 mb-2">
                Size: {(result.size / 1024 / 1024).toFixed(2)} MB
                <br />
                Time: {result.time}ms
              </div>
              <div className="bg-gray-100 p-2 rounded">
                <img 
                  src={result.url} 
                  alt={result.name}
                  className="w-full"
                  style={{ maxHeight: '300px', objectFit: 'contain' }}
                />
              </div>
              <a 
                href={result.url} 
                download={`test-${result.name.replace(/\s+/g, '-')}.jpg`}
                className="text-blue-500 underline text-sm mt-2 block"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}