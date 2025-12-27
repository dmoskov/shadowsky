# AI Features Developer Guide

## Document Information
- **Created**: 2025-12-27
- **Asana Task**: https://app.asana.com/0/1211710875848660/1212598914422287
- **Audience**: Developers working with AI features

## Quick Start

This guide provides practical examples for implementing and extending AI features in ShadowSky.

---

## Table of Contents

1. [Adding a New AI Feature](#adding-a-new-ai-feature)
2. [Using Existing AI Services](#using-existing-ai-services)
3. [Error Handling Patterns](#error-handling-patterns)
4. [Testing AI Features](#testing-ai-features)
5. [Best Practices](#best-practices)
6. [Common Pitfalls](#common-pitfalls)

---

## Adding a New AI Feature

### Step 1: Add Backend Endpoint

First, implement the backend endpoint that calls Anthropic's API.

**Example: Adding "Expand Text" feature**

```typescript
// Backend: amplify/functions/api-handler/handler.ts (or similar)

async function expandText(text: string): Promise<{ expandedText: string }> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-3-5-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Expand this text with more details while keeping the same meaning:\n\n${text}`
      }]
    })
  });

  const data = await response.json();
  return {
    expandedText: data.content[0].text
  };
}

// Export endpoint
export const POST_expand_text = async (event) => {
  const { text } = JSON.parse(event.body);
  return await expandText(text);
};
```

### Step 2: Add Client Service Function

Add the function to `src/services/anthropic.ts`:

```typescript
// src/services/anthropic.ts

export interface TextExpansionResult {
  expandedText: string;
  originalText: string;
}

export async function expandText(text: string): Promise<TextExpansionResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetchWithRetry(
      `${apiBaseUrl}/api/expand-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ text }),
      },
      API_RETRY_OPTIONS,
    );

    const data = await response.json();
    return {
      expandedText: data.expandedText,
      originalText: text,
    };
  } catch (error) {
    logger.error('Error expanding text:', error);

    // Consistent error handling pattern
    if (error instanceof Error && error.message.includes('401')) {
      throw new Error('Text expansion failed: Invalid API key');
    } else if (error instanceof Error && error.message.includes('429')) {
      throw new Error('Text expansion failed: Rate limit exceeded');
    } else {
      throw new Error(
        `Text expansion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
```

### Step 3: Add Type Definitions

Add types to `src/components/composer/types.ts`:

```typescript
// src/components/composer/types.ts

import type { TextExpansionResult } from '../../services/anthropic';

export type { TextExpansionResult };

// Add to ComposerState interface
export interface ComposerState {
  // ... existing properties ...

  // Text expansion state
  showTextExpansion: boolean;
  textExpansionResult: TextExpansionResult | null;
  isExpandingText: boolean;
}
```

### Step 4: Add UI Component

Create a button in the toolbar:

```typescript
// src/components/composer/ComposerToolbar.tsx

// Add import for icon
import { Expand } from 'lucide-react';

// Add button in the toolbar
{showAdvancedFeatures && (
  <ToolbarButton
    icon={<Expand size={20} />}
    onClick={onExpandText}
    disabled={isPosting || isExpandingText || !text.trim()}
    label="Expand text"
    loading={isExpandingText}
    tooltip={{
      title: 'Expand Text',
      description: 'Add more details to your post',
      detail: 'AI will expand while keeping meaning',
    }}
  />
)}
```

### Step 5: Implement State Management

Add handlers in `src/components/composer/useComposerState.ts`:

```typescript
// src/components/composer/useComposerState.ts

const handleExpandText = useCallback(async () => {
  if (!state.text.trim()) return;

  setState(prev => ({ ...prev, isExpandingText: true }));

  try {
    const result = await expandText(state.text);
    setState(prev => ({
      ...prev,
      textExpansionResult: result,
      showTextExpansion: true,
      isExpandingText: false,
    }));
  } catch (error) {
    logger.error('Failed to expand text:', error);
    setState(prev => ({ ...prev, isExpandingText: false }));

    // Show error to user
    const errorMessage = error instanceof Error
      ? error.message
      : 'Failed to expand text';
    // Display error toast/notification
  }
}, [state.text]);

return {
  // ... existing returns ...
  onExpandText: handleExpandText,
};
```

### Step 6: Display Results

Create a preview component:

```typescript
// src/components/composer/TextExpansionPreview.tsx

interface TextExpansionPreviewProps {
  result: TextExpansionResult;
  onApply: () => void;
  onCancel: () => void;
}

export const TextExpansionPreview: React.FC<TextExpansionPreviewProps> = ({
  result,
  onApply,
  onCancel,
}) => {
  return (
    <div className="bsky-card p-4">
      <h3 className="text-sm font-semibold mb-2">Expanded Text Preview</h3>

      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Original:</div>
        <div className="p-2 bg-gray-50 rounded">{result.originalText}</div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Expanded:</div>
        <div className="p-2 bg-blue-50 rounded">{result.expandedText}</div>
      </div>

      <div className="flex gap-2 justify-end">
        <button className="bsky-button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="bsky-button-primary" onClick={onApply}>
          Apply Expanded Text
        </button>
      </div>
    </div>
  );
};
```

---

## Using Existing AI Services

### Tone Adjustment

```typescript
import { adjustTone } from '../../services/anthropic';

// In your component
const handleAdjustTone = async () => {
  try {
    const result = await adjustTone(text, 'professional');
    console.log('Adjusted text:', result.adjustedText);
    // Update your state with result.adjustedText
  } catch (error) {
    console.error('Tone adjustment failed:', error);
    // Handle error
  }
};
```

### Alt Text Generation

```typescript
import { generateAltText } from '../../services/anthropic';

// When user uploads an image
const handleImageUpload = async (file: File) => {
  const preview = URL.createObjectURL(file);

  // Add to media immediately
  const imageId = generateId();
  addMedia({ id: imageId, file, preview, alt: '', type: 'image' });

  // Generate alt text if enabled
  if (autoGenerateAltText) {
    try {
      const altText = await generateAltText(preview);
      updateMediaAlt(imageId, altText);
    } catch (error) {
      console.error('Alt text generation failed:', error);
      // User can still add alt text manually
    }
  }
};
```

### Writing Feedback

```typescript
import { getStyleMatchedWritingFeedback } from '../../services/anthropic';

// Requires BskyAgent instance
const handleGetFeedback = async (agent: BskyAgent) => {
  try {
    const feedback = await getStyleMatchedWritingFeedback(text, agent);

    console.log('Assessment:', feedback.assessment.summary);
    console.log('Corrected:', feedback.correctedVersion.text);
    console.log('Enhanced:', feedback.enhancedVersion.text);
    console.log('Style Match:', feedback.styleAnalysis.matchesStyle);

    // Display in UI
  } catch (error) {
    console.error('Feedback failed:', error);
  }
};
```

### Thread Optimization

```typescript
import { optimizeThread } from '../../services/anthropic';

const handleOptimizeThread = async () => {
  try {
    const result = await optimizeThread(longText, 300);

    console.log('Split into', result.totalPosts, 'posts');
    console.log('Suggested format:', result.suggestedFormat);

    // Apply segments to posts
    const posts = result.segments.map(seg => seg.text);
    setPosts(posts);
  } catch (error) {
    console.error('Thread optimization failed:', error);
  }
};
```

---

## Error Handling Patterns

### Standard Error Handler

```typescript
async function callAIFeature<T>(
  apiCall: () => Promise<T>,
  featureName: string
): Promise<T | null> {
  try {
    return await apiCall();
  } catch (error) {
    logger.error(`${featureName} failed:`, error);

    let userMessage = `${featureName} is temporarily unavailable.`;

    if (error instanceof Error) {
      if (error.message.includes('401')) {
        userMessage = 'AI service authentication failed.';
      } else if (error.message.includes('429')) {
        userMessage = 'Too many requests. Please wait a moment.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.';
      }
    }

    // Show error to user (toast, alert, etc.)
    showErrorMessage(userMessage);

    return null;
  }
}

// Usage
const result = await callAIFeature(
  () => adjustTone(text, 'professional'),
  'Tone adjustment'
);

if (result) {
  // Success - use result
} else {
  // Error was handled, continue gracefully
}
```

### With Loading State

```typescript
const handleAIFeature = async () => {
  setIsLoading(true);
  setError(null);

  try {
    const result = await someAIFunction();
    setResult(result);
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error';
    setError(errorMessage);
    logger.error('AI feature failed:', error);
  } finally {
    setIsLoading(false);
  }
};
```

### With Retry Logic

The retry logic is built into `fetchWithRetry`, but you can add additional retries:

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes('401')) {
        throw error;
      }

      // Wait before retry
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}
```

---

## Testing AI Features

### Mock AI Service

Create a mock for testing:

```typescript
// src/services/__mocks__/anthropic.ts

export const adjustTone = jest.fn().mockResolvedValue({
  adjustedText: 'Mocked adjusted text',
  originalText: 'Original text',
  tone: 'professional',
});

export const generateAltText = jest.fn().mockResolvedValue(
  'A mocked alt text description'
);

export const getWritingFeedback = jest.fn().mockResolvedValue({
  assessment: {
    summary: 'Mocked assessment',
    hasIssues: false,
  },
  correctedVersion: {
    text: 'Mocked corrected text',
    changes: [],
  },
  enhancedVersion: {
    text: 'Mocked enhanced text',
    improvements: [],
  },
});
```

### Unit Test Example

```typescript
// src/components/composer/__tests__/AIFeatures.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { adjustTone } from '../../services/anthropic';
import { Composer } from '../ComposerRefactored';

jest.mock('../../services/anthropic');

describe('AI Features', () => {
  it('adjusts tone when button clicked', async () => {
    const mockAdjustTone = adjustTone as jest.MockedFunction<typeof adjustTone>;
    mockAdjustTone.mockResolvedValue({
      adjustedText: 'Professional version',
      originalText: 'casual text',
      tone: 'professional',
    });

    render(<Composer />);

    // Type some text
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'casual text' } });

    // Click tone button
    const toneButton = screen.getByLabelText('Adjust tone');
    fireEvent.click(toneButton);

    // Select professional tone
    const professionalOption = screen.getByText('Professional');
    fireEvent.click(professionalOption);

    // Wait for API call
    await waitFor(() => {
      expect(mockAdjustTone).toHaveBeenCalledWith('casual text', 'professional');
    });

    // Check preview is shown
    expect(screen.getByText('Professional version')).toBeInTheDocument();
  });

  it('handles errors gracefully', async () => {
    const mockAdjustTone = adjustTone as jest.MockedFunction<typeof adjustTone>;
    mockAdjustTone.mockRejectedValue(new Error('Rate limit exceeded'));

    render(<Composer />);

    // Trigger tone adjustment
    // ... user actions ...

    await waitFor(() => {
      expect(screen.getByText(/rate limit/i)).toBeInTheDocument();
    });
  });
});
```

### Integration Test

```typescript
// Test with real backend (in dev environment)
describe('AI Integration Tests', () => {
  it('generates alt text for image', async () => {
    // Skip if no backend available
    if (!process.env.TEST_WITH_BACKEND) {
      return;
    }

    const testImage = 'data:image/png;base64,...';
    const altText = await generateAltText(testImage);

    expect(altText).toBeTruthy();
    expect(altText.length).toBeGreaterThan(10);
  });
});
```

---

## Best Practices

### 1. Always Show Loading States

```typescript
// ✅ Good
const handleAIAction = async () => {
  setIsLoading(true);
  try {
    const result = await aiFunction();
    setResult(result);
  } finally {
    setIsLoading(false);
  }
};

// ❌ Bad - no loading indicator
const handleAIAction = async () => {
  const result = await aiFunction();
  setResult(result);
};
```

### 2. Provide Cancel Options

```typescript
// ✅ Good - allow cancellation
const abortController = new AbortController();

const handleAIAction = async () => {
  try {
    const result = await aiFunction({ signal: abortController.signal });
    setResult(result);
  } catch (error) {
    if (error.name === 'AbortError') {
      // User cancelled, no error message needed
      return;
    }
    handleError(error);
  }
};

const handleCancel = () => {
  abortController.abort();
};
```

### 3. Preserve User Input

```typescript
// ✅ Good - show preview, let user decide
const handleAdjustTone = async () => {
  const result = await adjustTone(text, tone);
  setPreview(result.adjustedText);  // Don't overwrite immediately
  setShowPreview(true);
};

const handleApplyPreview = () => {
  setText(preview);  // User explicitly accepts
  setShowPreview(false);
};

// ❌ Bad - overwrites without confirmation
const handleAdjustTone = async () => {
  const result = await adjustTone(text, tone);
  setText(result.adjustedText);  // Lost original!
};
```

### 4. Cache When Appropriate

```typescript
// ✅ Good - cache thread summaries
const summaryCache = new Map<string, ThreadSummaryResult>();

const getThreadSummary = async (threadId: string) => {
  if (summaryCache.has(threadId)) {
    return summaryCache.get(threadId);
  }

  const summary = await generateThreadSummary(posts);
  summaryCache.set(threadId, summary);
  return summary;
};
```

### 5. Degrade Gracefully

```typescript
// ✅ Good - composer still works if AI fails
const Composer = () => {
  const [aiAvailable, setAiAvailable] = useState(true);

  const handleAIFeature = async () => {
    try {
      return await aiFunction();
    } catch (error) {
      setAiAvailable(false);  // Hide AI features
      // Composer continues working normally
    }
  };

  return (
    <div>
      <TextArea />  {/* Always available */}
      <MediaUpload />  {/* Always available */}

      {aiAvailable && <AIFeatures />}  {/* Optional */}
    </div>
  );
};
```

### 6. Log for Debugging

```typescript
// ✅ Good - helpful logging
const handleAIFeature = async () => {
  logger.log('AI feature started', { textLength: text.length });

  try {
    const result = await aiFunction();
    logger.log('AI feature completed', { resultLength: result.length });
    return result;
  } catch (error) {
    logger.error('AI feature failed', { error, text: text.substring(0, 50) });
    throw error;
  }
};
```

---

## Common Pitfalls

### ❌ Exposing API Keys

```typescript
// ❌ NEVER DO THIS
const ANTHROPIC_API_KEY = 'sk-ant-...';  // Exposed to client!

fetch('https://api.anthropic.com/v1/messages', {
  headers: {
    'x-api-key': ANTHROPIC_API_KEY,  // Visible in browser!
  },
});

// ✅ Always use backend proxy
const result = await fetch('/api/ai-feature', {
  headers: getApiAuthHeaders(),  // Custom auth for backend
});
```

### ❌ Not Handling Timeouts

```typescript
// ❌ Bad - no timeout
const result = await fetch('/api/ai-feature');

// ✅ Good - with timeout
const result = await fetchWithRetry(
  '/api/ai-feature',
  { method: 'POST', body: ... },
  { timeout: 60000 }  // 60 seconds
);
```

### ❌ Ignoring Rate Limits

```typescript
// ❌ Bad - spam API
images.forEach(async (image) => {
  await generateAltText(image);  // Too many simultaneous requests!
});

// ✅ Good - sequential or batched
for (const image of images) {
  await generateAltText(image);
  await delay(500);  // Respect rate limits
}
```

### ❌ Not Validating Input

```typescript
// ❌ Bad - send anything
const result = await adjustTone(text, tone);

// ✅ Good - validate first
if (!text.trim()) {
  throw new Error('Text cannot be empty');
}
if (text.length > 10000) {
  throw new Error('Text too long (max 10,000 chars)');
}
const result = await adjustTone(text, tone);
```

### ❌ Blocking UI

```typescript
// ❌ Bad - blocks UI thread
const handleAIFeature = async () => {
  showModal('Processing...');
  const result = await aiFunction();  // User can't interact!
  hideModal();
};

// ✅ Good - non-blocking with cancel option
const handleAIFeature = async () => {
  setIsProcessing(true);  // Show loading state, UI still responsive
  try {
    const result = await aiFunction();
    // ...
  } finally {
    setIsProcessing(false);
  }
};
```

---

## Performance Tips

### 1. Debounce Suggestions

```typescript
// For auto-suggestions like hashtags
const debouncedSuggestHashtags = useMemo(
  () => debounce(async (text: string) => {
    const suggestions = await suggestHashtags(text);
    setHashtagSuggestions(suggestions);
  }, 1000),  // Wait 1s after user stops typing
  []
);

useEffect(() => {
  if (text.length > 20) {
    debouncedSuggestHashtags(text);
  }
}, [text]);
```

### 2. Cancel Stale Requests

```typescript
// Cancel previous request when new one starts
let currentRequest: AbortController | null = null;

const handleAIFeature = async () => {
  // Cancel previous request
  if (currentRequest) {
    currentRequest.abort();
  }

  currentRequest = new AbortController();

  try {
    const result = await aiFunction({ signal: currentRequest.signal });
    setResult(result);
  } catch (error) {
    if (error.name !== 'AbortError') {
      handleError(error);
    }
  }
};
```

### 3. Lazy Load AI Features

```typescript
// Only load AI components when needed
const AIFeatures = lazy(() => import('./ComposerAIFeatures'));

<Suspense fallback={<Spinner />}>
  {showAIFeatures && <AIFeatures />}
</Suspense>
```

---

## Resources

- **Architecture Doc**: `docs/architecture/AI_WRITING_ASSISTANT_INTEGRATION.md`
- **Data Flow Diagrams**: `docs/architecture/AI_INTEGRATION_DATA_FLOW.md`
- **Service Code**: `src/services/anthropic.ts`
- **Composer Components**: `src/components/composer/`
- **Anthropic API Docs**: https://docs.anthropic.com/

---

**Last Updated**: 2025-12-27
