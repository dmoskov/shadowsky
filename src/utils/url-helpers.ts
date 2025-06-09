/**
 * URL helper functions for generating shareable Bluesky links
 */

/**
 * Convert an AT Protocol URI to a Bluesky web URL
 * AT URI format: at://did:plc:xxxxx/app.bsky.feed.post/3jxxxxx
 * Web URL format: https://bsky.app/profile/handle/post/3jxxxxx
 */
export function atUriToWebUrl(uri: string, handle: string): string {
  try {
    // Parse the AT URI
    const match = uri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/(.+)$/)
    if (!match) {
      throw new Error('Invalid AT URI format')
    }
    
    const [, , collection, rkey] = match
    
    // For posts, generate the proper Bluesky URL
    if (collection === 'app.bsky.feed.post') {
      return `https://bsky.app/profile/${handle}/post/${rkey}`
    }
    
    // For other types, return a generic profile URL
    return `https://bsky.app/profile/${handle}`
  } catch (error) {
    console.error('Error parsing AT URI:', error)
    // Fallback to profile URL
    return `https://bsky.app/profile/${handle}`
  }
}

/**
 * Copy text to clipboard with fallback for older browsers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        return successful
      } catch (_err) {
        document.body.removeChild(textArea)
        return false
      }
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Share a URL using the Web Share API if available
 */
export async function shareUrl(url: string, title?: string, text?: string): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({
        title: title || 'Check out this post on Bluesky',
        text: text || '',
        url: url
      })
      return true
    } else {
      // Fallback to copying to clipboard
      return copyToClipboard(url)
    }
  } catch (error) {
    // User cancelled or error occurred
    if ((error as Error).name !== 'AbortError') {
      console.error('Error sharing:', error)
    }
    return false
  }
}