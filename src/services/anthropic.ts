import Anthropic from '@anthropic-ai/sdk';
import { trackError } from './analytics';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true
});

export async function generateAltText(imageDataUrl: string): Promise<string> {
  try {
    // Check if API key is configured
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }
    let base64Data: string;
    let mediaType: string = 'image/jpeg';
    
    // Handle blob URLs by converting to base64
    if (imageDataUrl.startsWith('blob:')) {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      mediaType = blob.type || 'image/jpeg';
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      base64Data = await base64Promise;
    } else if (imageDataUrl.startsWith('data:')) {
      // Extract base64 data from data URL
      const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid data URL format');
      }
      mediaType = matches[1];
      base64Data = matches[2];
    } else {
      throw new Error('Unsupported image URL format');
    }
    
    if (!base64Data) {
      throw new Error('Failed to extract image data');
    }
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Data
              }
            },
            {
              type: 'text',
              text: 'Generate a concise, descriptive alt text for this image. The alt text should describe what is visible in the image for someone who cannot see it. Keep it under 125 characters and be factual. Do not include "image of" or "picture of" at the beginning.'
            }
          ]
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Ensure the alt text is not too long
      const altText = content.text.trim();
      return altText.length > 125 ? altText.substring(0, 122) + '...' : altText;
    }
    
    return '';
  } catch (error) {
    console.error('Error generating alt text:', error);
    
    // Track error for analytics
    trackError(error as Error, {
      context: 'alt_text_generation',
      apiKeyPresent: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
      imageFormat: imageDataUrl.substring(0, 20) // Log start of URL for debugging
    });
    
    // Provide more specific error messages
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error('Alt text generation failed: API key not configured');
    } else if (error instanceof Error && error.message.includes('401')) {
      throw new Error('Alt text generation failed: Invalid API key');
    } else if (error instanceof Error && error.message.includes('429')) {
      throw new Error('Alt text generation failed: Rate limit exceeded');
    } else {
      throw new Error(`Alt text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}