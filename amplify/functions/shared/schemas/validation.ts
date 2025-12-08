/**
 * Schema Validation Utilities
 *
 * Provides utilities for validating AI responses against Zod schemas
 * and generating detailed error messages for debugging.
 */

import { z, type ZodSchema, type ZodError } from 'zod';

/**
 * Result of schema validation
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    issues: ValidationIssue[];
  };
}

/**
 * Individual validation issue with path and details
 */
export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

/**
 * Custom error class for schema validation failures
 */
export class SchemaValidationError extends Error {
  public readonly issues: ValidationIssue[];
  public readonly handlerName: string;

  constructor(handlerName: string, issues: ValidationIssue[]) {
    const message = `AI response validation failed for ${handlerName}: ${formatIssues(issues)}`;
    super(message);
    this.name = 'SchemaValidationError';
    this.handlerName = handlerName;
    this.issues = issues;
  }
}

/**
 * Format validation issues into a human-readable string
 */
function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
}

/**
 * Convert ZodError to our ValidationIssue format
 */
function zodErrorToIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validate data against a Zod schema
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns ValidationResult with success/failure and data or error details
 */
export function validateSchema<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const issues = zodErrorToIssues(result.error);
  return {
    success: false,
    error: {
      message: formatIssues(issues),
      issues,
    },
  };
}

/**
 * Validate data against a schema and throw SchemaValidationError on failure
 *
 * @param handlerName - Name of the handler (for error messages)
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns The validated and typed data
 * @throws SchemaValidationError if validation fails
 */
export function validateOrThrow<T>(handlerName: string, schema: ZodSchema<T>, data: unknown): T {
  const result = validateSchema(schema, data);

  if (!result.success) {
    throw new SchemaValidationError(handlerName, result.error!.issues);
  }

  return result.data!;
}

/**
 * Schema registry mapping handler names to their response schemas
 * This allows the handler factory to automatically validate responses
 */
export const RESPONSE_SCHEMAS: Record<string, ZodSchema> = {};

/**
 * Register a schema for a handler
 *
 * @param handlerName - Name of the handler
 * @param schema - The Zod schema for the handler's response
 */
export function registerSchema(handlerName: string, schema: ZodSchema): void {
  RESPONSE_SCHEMAS[handlerName] = schema;
}

/**
 * Get the registered schema for a handler
 *
 * @param handlerName - Name of the handler
 * @returns The registered schema or undefined if not registered
 */
export function getSchema(handlerName: string): ZodSchema | undefined {
  return RESPONSE_SCHEMAS[handlerName];
}
