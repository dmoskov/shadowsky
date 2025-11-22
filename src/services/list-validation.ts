import DOMPurify from "dompurify";
import { z } from "zod";

const DID_REGEX = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/;
const HANDLE_REGEX =
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const URI_REGEX =
  /^at:\/\/did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]\/app\.bsky\.graph\.list\/[a-zA-Z0-9]+$/;

export const listNameSchema = z
  .string()
  .min(1, "List name is required")
  .max(64, "List name must be 64 characters or less")
  .trim()
  .refine(
    (val) => val.length > 0,
    "List name cannot be empty or just whitespace",
  );

export const listDescriptionSchema = z
  .string()
  .max(256, "List description must be 256 characters or less")
  .optional();

export const didSchema = z
  .string()
  .regex(
    DID_REGEX,
    "Invalid DID format. Must follow ATProto DID specification (e.g., did:plc:...)",
  );

export const handleSchema = z
  .string()
  .regex(
    HANDLE_REGEX,
    "Invalid handle format. Must be a valid domain-like handle (e.g., user.bsky.social)",
  );

export const listUriSchema = z
  .string()
  .regex(
    URI_REGEX,
    "Invalid list URI format. Must be an AT Protocol URI for a list",
  );

export const listItemUriSchema = z
  .string()
  .regex(
    /^at:\/\/did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]\/app\.bsky\.graph\.listitem\/[a-zA-Z0-9]+$/,
    "Invalid list item URI format. Must be an AT Protocol URI for a list item",
  );

export const createListInputSchema = z.object({
  name: listNameSchema,
  description: listDescriptionSchema,
  avatar: z.instanceof(Blob).optional(),
});

export const updateListInputSchema = z.object({
  uri: listUriSchema,
  updates: z.object({
    name: listNameSchema.optional(),
    description: listDescriptionSchema,
  }),
});

export const addMemberInputSchema = z.object({
  listUri: listUriSchema,
  memberDid: didSchema,
});

export const removeMemberInputSchema = z.object({
  listItemUri: listItemUriSchema,
});

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public issues?: z.ZodIssue[],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

export function validateListName(name: string): string {
  try {
    return listNameSchema.parse(name);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message, "name", error.errors);
    }
    throw error;
  }
}

export function validateListDescription(
  description?: string,
): string | undefined {
  if (description === undefined || description === null || description === "") {
    return undefined;
  }

  try {
    const validated = listDescriptionSchema.parse(description);
    return validated ? sanitizeHtml(validated) : undefined;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        error.errors[0].message,
        "description",
        error.errors,
      );
    }
    throw error;
  }
}

export function validateDid(did: string): string {
  try {
    return didSchema.parse(did);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message, "did", error.errors);
    }
    throw error;
  }
}

export function validateHandle(handle: string): string {
  try {
    return handleSchema.parse(handle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        error.errors[0].message,
        "handle",
        error.errors,
      );
    }
    throw error;
  }
}

export function validateListUri(uri: string): string {
  try {
    return listUriSchema.parse(uri);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message, "uri", error.errors);
    }
    throw error;
  }
}

export function validateListItemUri(uri: string): string {
  try {
    return listItemUriSchema.parse(uri);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message, "uri", error.errors);
    }
    throw error;
  }
}

export function validateCreateListInput(input: {
  name: string;
  description?: string;
  avatar?: Blob;
}): {
  name: string;
  description?: string;
  avatar?: Blob;
} {
  try {
    const validated = createListInputSchema.parse(input);
    return {
      ...validated,
      description: validateListDescription(validated.description),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join("."),
        error.errors,
      );
    }
    throw error;
  }
}

export function validateUpdateListInput(input: {
  uri: string;
  updates: { name?: string; description?: string };
}): {
  uri: string;
  updates: { name?: string; description?: string };
} {
  try {
    const validated = updateListInputSchema.parse(input);
    return {
      uri: validated.uri,
      updates: {
        name: validated.updates.name,
        description: validateListDescription(validated.updates.description),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join("."),
        error.errors,
      );
    }
    throw error;
  }
}

export function validateAddMemberInput(input: {
  listUri: string;
  memberDid: string;
}): {
  listUri: string;
  memberDid: string;
} {
  try {
    return addMemberInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join("."),
        error.errors,
      );
    }
    throw error;
  }
}

export function validateRemoveMemberInput(input: { listItemUri: string }): {
  listItemUri: string;
} {
  try {
    return removeMemberInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        firstError.message,
        firstError.path.join("."),
        error.errors,
      );
    }
    throw error;
  }
}
