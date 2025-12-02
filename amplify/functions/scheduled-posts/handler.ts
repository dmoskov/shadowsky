/**
 * Scheduled Posts API Handler
 *
 * Provides CRUD operations for scheduled posts with server-primary architecture.
 * Supports creating, reading, updating, and deleting scheduled posts.
 *
 * Endpoints:
 * - GET /api/scheduled-posts - List all scheduled posts for user
 * - GET /api/scheduled-posts/{id} - Get a specific scheduled post
 * - POST /api/scheduled-posts - Create a new scheduled post
 * - PUT /api/scheduled-posts/{id} - Update a scheduled post
 * - DELETE /api/scheduled-posts/{id} - Delete a scheduled post
 * - GET /api/scheduled-posts/time-sync - Get server time for synchronization
 */

import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
  ErrorCodes,
  getCorrelationId,
  getHttpMethod,
  isOptionsRequest,
  logError,
  logInfo,
  parseEventBody,
} from "../shared/api-response";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodb = new DynamoDBClient({});
const TABLE_NAME = process.env.SCHEDULED_POSTS_TABLE || "";

// Types matching frontend definitions
type ScheduledPostStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

interface ScheduledPostMedia {
  data: string;
  mimeType: string;
  alt: string;
  postIndex?: number;
}

interface ScheduledThreadPost {
  text: string;
  media?: ScheduledPostMedia[];
}

interface ThreadConfig {
  delayBetweenPosts: number;
  includeNumbering: boolean;
  numberingFormat: "none" | "simple" | "brackets" | "thread" | "dots";
  numberingPosition: "beginning" | "end";
}

interface ThreadgateConfig {
  type: "everyone" | "mentioned" | "followed" | "lists" | "none";
  listUris?: string[];
}

interface ScheduledPost {
  id: string;
  userDid: string;
  scheduledFor: string;
  status: ScheduledPostStatus;
  createdAt: string;
  updatedAt: string;
  text?: string;
  media?: ScheduledPostMedia[];
  threadPosts?: ScheduledThreadPost[];
  threadConfig?: ThreadConfig;
  threadgate?: ThreadgateConfig;
  replyTo?: { uri: string; cid: string };
  quotedPost?: { uri: string; cid: string };
  draftId?: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  lastAttemptAt?: string;
  publishedUris?: string[];
  publishedAt?: string;
  serverTimeOffset?: number;
}

interface CreateScheduledPostRequest {
  scheduledFor: string;
  text?: string;
  media?: ScheduledPostMedia[];
  threadPosts?: ScheduledThreadPost[];
  threadConfig?: ThreadConfig;
  threadgate?: ThreadgateConfig;
  replyTo?: { uri: string; cid: string };
  quotedPost?: { uri: string; cid: string };
  draftId?: string;
}

interface UpdateScheduledPostRequest {
  scheduledFor?: string;
  text?: string;
  media?: ScheduledPostMedia[];
  threadPosts?: ScheduledThreadPost[];
  threadConfig?: ThreadConfig;
  threadgate?: ThreadgateConfig;
  status?: ScheduledPostStatus;
}

function generateId(): string {
  return `sched_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function extractUserDid(event: any): string | null {
  // Extract user DID from Authorization header (expects "Bearer {did}" or just "{did}")
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  return parts.length === 2 ? parts[1] : parts[0];
}

function getPathParameter(event: any, param: string): string | null {
  return event.pathParameters?.[param] || null;
}

export const handler = async (event: any) => {
  const correlationId = getCorrelationId(event);

  if (isOptionsRequest(event)) {
    return createOptionsResponse(event);
  }

  if (!TABLE_NAME) {
    logError("scheduled-posts", "Table name not configured", correlationId);
    return createErrorResponse(
      500,
      ErrorCodes.CONFIG_ERROR,
      "Server configuration error",
      event,
      { correlationId }
    );
  }

  const method = getHttpMethod(event);
  const path = event.path || event.rawPath || "";
  const postId = getPathParameter(event, "id");

  // Handle time-sync endpoint
  if (path.endsWith("/time-sync")) {
    return handleTimeSync(event, correlationId);
  }

  const userDid = extractUserDid(event);
  if (!userDid) {
    return createErrorResponse(
      401,
      ErrorCodes.UNAUTHORIZED,
      "Authorization header required with user DID",
      event,
      { correlationId }
    );
  }

  try {
    switch (method) {
      case "GET":
        if (postId) {
          return await handleGetOne(event, userDid, postId, correlationId);
        }
        return await handleList(event, userDid, correlationId);

      case "POST":
        return await handleCreate(event, userDid, correlationId);

      case "PUT":
        if (!postId) {
          return createErrorResponse(
            400,
            ErrorCodes.MISSING_PARAMETER,
            "Post ID required for update",
            event,
            { correlationId }
          );
        }
        return await handleUpdate(event, userDid, postId, correlationId);

      case "DELETE":
        if (!postId) {
          return createErrorResponse(
            400,
            ErrorCodes.MISSING_PARAMETER,
            "Post ID required for delete",
            event,
            { correlationId }
          );
        }
        return await handleDelete(event, userDid, postId, correlationId);

      default:
        return createErrorResponse(
          405,
          ErrorCodes.METHOD_NOT_ALLOWED,
          `Method ${method} not allowed`,
          event,
          { correlationId }
        );
    }
  } catch (error) {
    logError("scheduled-posts", error, correlationId);
    return createErrorResponse(
      500,
      ErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Internal server error",
      event,
      { correlationId }
    );
  }
};

async function handleTimeSync(event: any, correlationId: string) {
  const serverTime = new Date();
  logInfo("scheduled-posts", "Time sync requested", correlationId);

  return createSuccessResponse(
    {
      serverTime: serverTime.toISOString(),
      serverTimestamp: serverTime.getTime(),
    },
    event,
    { correlationId }
  );
}

async function handleList(event: any, userDid: string, correlationId: string) {
  const queryParams = event.queryStringParameters || {};
  const status = queryParams.status as ScheduledPostStatus | undefined;
  const limit = Math.min(parseInt(queryParams.limit || "100", 10), 100);

  logInfo("scheduled-posts", `Listing posts for user`, correlationId, {
    userDid,
    status,
    limit,
  });

  const params: any = {
    TableName: TABLE_NAME,
    IndexName: "userDid-scheduledFor-index",
    KeyConditionExpression: "userDid = :userDid",
    ExpressionAttributeValues: marshall({
      ":userDid": userDid,
    }),
    Limit: limit,
    ScanIndexForward: true, // Ascending order by scheduledFor
  };

  if (status) {
    params.FilterExpression = "#status = :status";
    params.ExpressionAttributeNames = { "#status": "status" };
    params.ExpressionAttributeValues = marshall({
      ":userDid": userDid,
      ":status": status,
    });
  }

  const result = await dynamodb.send(new QueryCommand(params));
  const posts = (result.Items || []).map((item) => unmarshall(item));

  return createSuccessResponse({ posts, count: posts.length }, event, {
    correlationId,
  });
}

async function handleGetOne(
  event: any,
  userDid: string,
  postId: string,
  correlationId: string
) {
  logInfo("scheduled-posts", `Getting post ${postId}`, correlationId);

  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id: postId }),
    })
  );

  if (!result.Item) {
    return createErrorResponse(
      404,
      ErrorCodes.NOT_FOUND,
      "Scheduled post not found",
      event,
      { correlationId }
    );
  }

  const post = unmarshall(result.Item) as ScheduledPost;

  // Verify ownership
  if (post.userDid !== userDid) {
    return createErrorResponse(
      403,
      ErrorCodes.FORBIDDEN,
      "Not authorized to access this post",
      event,
      { correlationId }
    );
  }

  return createSuccessResponse({ post }, event, { correlationId });
}

async function handleCreate(
  event: any,
  userDid: string,
  correlationId: string
) {
  const body = parseEventBody<CreateScheduledPostRequest>(event);

  if (!body) {
    return createErrorResponse(
      400,
      ErrorCodes.BAD_REQUEST,
      "Invalid request body",
      event,
      { correlationId }
    );
  }

  if (!body.scheduledFor) {
    return createErrorResponse(
      400,
      ErrorCodes.MISSING_PARAMETER,
      "scheduledFor is required",
      event,
      { correlationId }
    );
  }

  // Validate scheduled time is in the future
  const scheduledTime = new Date(body.scheduledFor);
  if (isNaN(scheduledTime.getTime())) {
    return createErrorResponse(
      400,
      ErrorCodes.INVALID_PARAMETER,
      "Invalid scheduledFor date format",
      event,
      { correlationId }
    );
  }

  if (scheduledTime.getTime() <= Date.now()) {
    return createErrorResponse(
      400,
      ErrorCodes.INVALID_PARAMETER,
      "scheduledFor must be in the future",
      event,
      { correlationId }
    );
  }

  // Validate content exists
  if (!body.text && (!body.threadPosts || body.threadPosts.length === 0)) {
    return createErrorResponse(
      400,
      ErrorCodes.VALIDATION_ERROR,
      "Either text or threadPosts is required",
      event,
      { correlationId }
    );
  }

  const now = new Date().toISOString();
  const post: ScheduledPost = {
    id: generateId(),
    userDid,
    scheduledFor: body.scheduledFor,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    text: body.text,
    media: body.media,
    threadPosts: body.threadPosts,
    threadConfig: body.threadConfig,
    threadgate: body.threadgate,
    replyTo: body.replyTo,
    quotedPost: body.quotedPost,
    draftId: body.draftId,
    retryCount: 0,
    maxRetries: 3,
  };

  logInfo("scheduled-posts", `Creating post ${post.id}`, correlationId, {
    scheduledFor: post.scheduledFor,
  });

  await dynamodb.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(post, { removeUndefinedValues: true }),
    })
  );

  return createSuccessResponse({ post }, event, {
    statusCode: 201,
    correlationId,
  });
}

async function handleUpdate(
  event: any,
  userDid: string,
  postId: string,
  correlationId: string
) {
  // First get the existing post to verify ownership
  const getResult = await dynamodb.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id: postId }),
    })
  );

  if (!getResult.Item) {
    return createErrorResponse(
      404,
      ErrorCodes.NOT_FOUND,
      "Scheduled post not found",
      event,
      { correlationId }
    );
  }

  const existingPost = unmarshall(getResult.Item) as ScheduledPost;

  if (existingPost.userDid !== userDid) {
    return createErrorResponse(
      403,
      ErrorCodes.FORBIDDEN,
      "Not authorized to update this post",
      event,
      { correlationId }
    );
  }

  // Don't allow updates to completed/processing posts
  if (
    existingPost.status === "completed" ||
    existingPost.status === "processing"
  ) {
    return createErrorResponse(
      400,
      ErrorCodes.BAD_REQUEST,
      `Cannot update post with status: ${existingPost.status}`,
      event,
      { correlationId }
    );
  }

  const body = parseEventBody<UpdateScheduledPostRequest>(event);
  if (!body) {
    return createErrorResponse(
      400,
      ErrorCodes.BAD_REQUEST,
      "Invalid request body",
      event,
      { correlationId }
    );
  }

  // Validate scheduledFor if provided
  if (body.scheduledFor) {
    const scheduledTime = new Date(body.scheduledFor);
    if (isNaN(scheduledTime.getTime())) {
      return createErrorResponse(
        400,
        ErrorCodes.INVALID_PARAMETER,
        "Invalid scheduledFor date format",
        event,
        { correlationId }
      );
    }

    if (scheduledTime.getTime() <= Date.now()) {
      return createErrorResponse(
        400,
        ErrorCodes.INVALID_PARAMETER,
        "scheduledFor must be in the future",
        event,
        { correlationId }
      );
    }
  }

  const updateExpressions: string[] = ["#updatedAt = :updatedAt"];
  const expressionAttributeNames: Record<string, string> = {
    "#updatedAt": "updatedAt",
  };
  const expressionAttributeValues: Record<string, any> = {
    ":updatedAt": new Date().toISOString(),
  };

  const updateFields: (keyof UpdateScheduledPostRequest)[] = [
    "scheduledFor",
    "text",
    "media",
    "threadPosts",
    "threadConfig",
    "threadgate",
    "status",
  ];

  for (const field of updateFields) {
    if (body[field] !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = body[field];
    }
  }

  logInfo("scheduled-posts", `Updating post ${postId}`, correlationId);

  const result = await dynamodb.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id: postId }),
      UpdateExpression: "SET " + updateExpressions.join(", "),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ReturnValues: "ALL_NEW",
    })
  );

  const updatedPost = unmarshall(result.Attributes || {}) as ScheduledPost;

  return createSuccessResponse({ post: updatedPost }, event, { correlationId });
}

async function handleDelete(
  event: any,
  userDid: string,
  postId: string,
  correlationId: string
) {
  // First get the existing post to verify ownership
  const getResult = await dynamodb.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id: postId }),
    })
  );

  if (!getResult.Item) {
    return createErrorResponse(
      404,
      ErrorCodes.NOT_FOUND,
      "Scheduled post not found",
      event,
      { correlationId }
    );
  }

  const existingPost = unmarshall(getResult.Item) as ScheduledPost;

  if (existingPost.userDid !== userDid) {
    return createErrorResponse(
      403,
      ErrorCodes.FORBIDDEN,
      "Not authorized to delete this post",
      event,
      { correlationId }
    );
  }

  // Don't allow deletion of processing posts
  if (existingPost.status === "processing") {
    return createErrorResponse(
      400,
      ErrorCodes.BAD_REQUEST,
      "Cannot delete post that is currently being processed",
      event,
      { correlationId }
    );
  }

  logInfo("scheduled-posts", `Deleting post ${postId}`, correlationId);

  await dynamodb.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ id: postId }),
    })
  );

  return createSuccessResponse({ deleted: true, id: postId }, event, {
    correlationId,
  });
}
