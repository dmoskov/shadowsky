import Anthropic from '@anthropic-ai/sdk';
import { analytics } from './analytics';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true
});

export type ToneOption = 'professional' | 'casual' | 'humorous' | 'informative' | 'inspirational';

export interface ToneAdjustmentResult {
  adjustedText: string;
  originalText: string;
  tone: ToneOption;
}

const TONE_DESCRIPTIONS: Record<ToneOption, string> = {
  professional: 'formal, clear, and business-appropriate language',
  casual: 'relaxed, conversational, and friendly language',
  humorous: 'witty, playful, and entertaining language while maintaining the core message',
  informative: 'educational, fact-focused, and explanatory language',
  inspirational: 'motivating, uplifting, and encouraging language'
};

export async function adjustTone(text: string, tone: ToneOption): Promise<ToneAdjustmentResult> {
  try {
    // Check if API key is configured
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Rewrite the following text to have a ${tone} tone. Use ${TONE_DESCRIPTIONS[tone]}. Maintain the original meaning and key information, but adjust the style and word choice. Keep it concise and suitable for a social media post (under 300 characters per segment if it needs to be split).

Original text: "${text}"

Provide only the rewritten text without any explanation or prefixes.`
        }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return {
        adjustedText: content.text.trim(),
        originalText: text,
        tone
      };
    }
    
    throw new Error('Unexpected response format');
  } catch (error) {
    console.error('Error adjusting tone:', error);
    
    // Track error for analytics
    analytics.trackError(error as Error, 'tone_adjustment');
    
    // Provide more specific error messages
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error('Tone adjustment failed: API key not configured');
    } else if (error instanceof Error && error.message.includes('401')) {
      throw new Error('Tone adjustment failed: Invalid API key');
    } else if (error instanceof Error && error.message.includes('429')) {
      throw new Error('Tone adjustment failed: Rate limit exceeded');
    } else {
      throw new Error(`Tone adjustment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

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
    analytics.trackError(error as Error, 'alt_text_generation');
    
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