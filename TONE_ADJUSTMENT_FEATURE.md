# Tone Adjustment Feature

## Overview

The Composer now includes an AI-powered tone adjustment feature that allows users to rewrite their posts in different tones using Claude AI.

## Features

- **5 Tone Options**: Professional, Casual, Humorous, Informative, and Inspirational
- **Preview Before Apply**: Users can preview the adjusted text before applying it
- **Visual Feedback**: Loading states, success/error messages, and clear UI indicators
- **Analytics Tracking**: All tone adjustments are tracked for usage analytics

## How to Use

1. Write your post in the composer
2. Click the magic wand (🪄) button in the toolbar
3. Select a tone from the dropdown
4. Preview the adjusted text
5. Click "Use This Version" to apply or "Cancel" to keep original

## Technical Implementation

### Files Modified

- `/src/services/anthropic.ts` - Added `adjustTone()` function and tone types
- `/src/components/Composer.tsx` - Added UI components and state management
- `/src/styles/composer.css` - Added styling for tone adjustment UI

### API Requirements

The feature requires an Anthropic API key to be set in the environment variable:

```
VITE_ANTHROPIC_API_KEY=your-api-key-here
```

### Tone Descriptions

- **Professional**: Formal, clear, and business-appropriate language
- **Casual**: Relaxed, conversational, and friendly language
- **Humorous**: Witty, playful, and entertaining language while maintaining the core message
- **Informative**: Educational, fact-focused, and explanatory language
- **Inspirational**: Motivating, uplifting, and encouraging language

### Analytics Events

The feature tracks the following events:

- `tone_adjustment_requested` - When a user selects a tone
- `tone_adjustment_success` - When tone adjustment completes successfully
- `tone_adjustment_applied` - When a user applies the adjusted text
- `tone_adjustment_error` - When an error occurs during adjustment

## Error Handling

- Missing API key shows clear error message
- Rate limiting is handled gracefully
- Network errors display user-friendly messages
- Original text is preserved if adjustment fails

## Future Enhancements

- Custom tone options
- Save preferred tones in user settings
- Batch tone adjustment for threads
- Tone suggestions based on content
