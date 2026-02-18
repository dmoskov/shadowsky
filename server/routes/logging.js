/**
 * Client Error Logging API Routes
 *
 * Endpoints for logging client-side errors to CloudWatch.
 */

const express = require("express");
const router = express.Router();
const {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
} = require("@aws-sdk/client-cloudwatch-logs");
const { moderateLimiter } = require("../middleware/rate-limit");
const { getClientIp } = require("../utils/helpers");

// Initialize CloudWatch client (only if AWS credentials are available)
let cloudWatchClient = null;
const LOG_GROUP_NAME = "/shadowsky/client-errors";
const LOG_STREAM_NAME = "client-error-stream";

try {
  cloudWatchClient = new CloudWatchLogsClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
  console.log("CloudWatch client initialized for error logging");
} catch (error) {
  console.warn(
    "CloudWatch client initialization failed - error logging will be local only:",
    error.message,
  );
}

// Helper to ensure log stream exists
async function ensureLogStream() {
  if (!cloudWatchClient) return null;

  try {
    const describeCommand = new DescribeLogStreamsCommand({
      logGroupName: LOG_GROUP_NAME,
      logStreamNamePrefix: LOG_STREAM_NAME,
    });

    const streams = await cloudWatchClient.send(describeCommand);

    if (
      !streams.logStreams ||
      !streams.logStreams.find((s) => s.logStreamName === LOG_STREAM_NAME)
    ) {
      const createCommand = new CreateLogStreamCommand({
        logGroupName: LOG_GROUP_NAME,
        logStreamName: LOG_STREAM_NAME,
      });
      await cloudWatchClient.send(createCommand);
      console.log(
        `Created CloudWatch log stream: ${LOG_GROUP_NAME}/${LOG_STREAM_NAME}`,
      );
    }

    const latestStream = streams.logStreams?.find(
      (s) => s.logStreamName === LOG_STREAM_NAME,
    );
    return latestStream?.uploadSequenceToken || null;
  } catch (error) {
    console.error("Error ensuring log stream:", error.message);
    return null;
  }
}

// Store sequence token in memory
let sequenceToken = null;

// Mutex to serialize CloudWatch PutLogEvents calls and prevent sequenceToken races
let cloudWatchMutex = Promise.resolve();

async function putLogEventsSerialized(logEvent) {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (sequenceToken === null) {
      sequenceToken = await ensureLogStream();
    }

    const putCommand = new PutLogEventsCommand({
      logGroupName: LOG_GROUP_NAME,
      logStreamName: LOG_STREAM_NAME,
      logEvents: [logEvent],
      sequenceToken: sequenceToken || undefined,
    });

    try {
      const response = await cloudWatchClient.send(putCommand);
      sequenceToken = response.nextSequenceToken;
      return true;
    } catch (error) {
      if (
        error.name === "InvalidSequenceTokenException" &&
        attempt < MAX_RETRIES
      ) {
        // Extract the correct token from the error and retry
        const expectedToken = error.expectedSequenceToken || null;
        sequenceToken = expectedToken;
        continue;
      }
      throw error;
    }
  }

  return false;
}

/**
 * POST /api/log-error
 * Log client-side errors to CloudWatch
 */
router.post("/log-error", moderateLimiter, async (req, res) => {
  const { message, stack, componentStack, context, url, userAgent, timestamp } =
    req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "Error message is required",
    });
  }

  const errorLog = {
    level: "CLIENT_ERROR",
    message: message.slice(0, 1000),
    stack: stack?.slice(0, 5000) || null,
    componentStack: componentStack?.slice(0, 5000) || null,
    context: context?.slice(0, 200) || "unknown",
    url: url?.slice(0, 500) || "unknown",
    userAgent: userAgent?.slice(0, 500) || "unknown",
    timestamp: timestamp || new Date().toISOString(),
    clientIp: getClientIp(req),
  };

  console.error("[CLIENT ERROR]", {
    message: errorLog.message,
    context: errorLog.context,
    url: errorLog.url,
    timestamp: errorLog.timestamp,
  });

  if (cloudWatchClient) {
    try {
      const logEvent = {
        message: JSON.stringify(errorLog),
        timestamp: new Date(errorLog.timestamp).getTime(),
      };

      // Chain onto the mutex so only one PutLogEvents runs at a time
      const result = await new Promise((resolve, reject) => {
        cloudWatchMutex = cloudWatchMutex
          .then(() => putLogEventsSerialized(logEvent))
          .then(resolve, reject);
      });

      if (result) {
        return res.status(200).json({
          success: true,
          logged: "cloudwatch",
        });
      }
    } catch (error) {
      console.error("Failed to log to CloudWatch:", error.message);
    }
  }

  res.status(200).json({
    success: true,
    logged: "local",
  });
});

// Export CloudWatch status for health checks
router.getCloudWatchStatus = () => ({
  available: !!cloudWatchClient,
});

module.exports = router;
