/**
 * Application-specific type definitions
 */

import { z } from 'zod'

// Zod schemas for runtime validation
export const LoginFormSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
})

export const PostFormSchema = z.object({
  text: z.string().min(1).max(300, 'Post must be between 1 and 300 characters'),
  images: z.array(z.instanceof(File)).max(4).optional(),
  replyTo: z.string().optional()
})

// Inferred types from schemas
export type LoginFormData = z.infer<typeof LoginFormSchema>
export type PostFormData = z.infer<typeof PostFormSchema>

// UI State types
export interface LoadingState {
  isLoading: boolean
  message?: string
}

export interface ErrorState {
  hasError: boolean
  error?: Error | null
  message?: string
}

// Feature flags (for future use)
export interface FeatureFlags {
  enablePostComposer: boolean
  enableNotifications: boolean
  enableDirectMessages: boolean
  enableThreadView: boolean
}