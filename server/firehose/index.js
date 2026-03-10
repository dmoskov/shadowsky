/**
 * Firehose Service Manager
 *
 * Orchestrates the firehose consumer and trending aggregator.
 * Handles lifecycle, metrics collection, and dynamic sampling.
 */

const { FirehoseConsumer } = require("./consumer");
const { TrendingAggregator } = require("./trending-aggregator");

let dynamoClient = null;

/**
 * Initialize DynamoDB client if AWS credentials are available
 */
function initDynamoClient() {
  try {
    const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
    dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-west-1",
    });
    return dynamoClient;
  } catch {
    return null;
  }
}

/**
 * Create and start the firehose trending service
 * @param {Object} options
 * @returns {{ consumer: FirehoseConsumer, aggregator: TrendingAggregator }}
 */
function createTrendingService(options = {}) {
  // Initialize DynamoDB if available
  const dynamo = options.dynamoClient || initDynamoClient();

  const aggregator = new TrendingAggregator({
    dynamoClient: dynamo,
    tableName: process.env.TRENDING_TABLE_NAME || "shadowsky-trending",
    topN: options.topN || 20,
    persistInterval: options.persistInterval || 60000,
  });

  const consumer = new FirehoseConsumer({
    sampleRate: parseInt(process.env.FIREHOSE_SAMPLE_RATE || "1", 10),
    maxReconnectAttempts: 50,
  });

  // Wire consumer events to aggregator
  consumer.on("post", (postData) => {
    aggregator.record(postData);
  });

  consumer.on("connected", ({ endpoint }) => {
    console.log(`[Firehose] Connected to ${endpoint}`);
  });

  consumer.on("disconnected", ({ code, reason }) => {
    console.log(`[Firehose] Disconnected: ${code} - ${reason}`);
  });

  consumer.on("error", (err) => {
    console.error(`[Firehose] Error: ${err.message}`);
  });

  consumer.on("maxReconnectsReached", () => {
    console.warn("[Firehose] Max reconnection attempts reached, resetting...");
  });

  // Dynamic sampling based on processing rate
  let lastProcessedCount = 0;
  const samplingTimer = setInterval(() => {
    const metrics = consumer.getMetrics();
    const processedPerMinute = metrics.messagesProcessed - lastProcessedCount;
    lastProcessedCount = metrics.messagesProcessed;

    // If processing more than 15k/minute, increase sampling
    if (processedPerMinute > 15000 && consumer.sampleRate < 10) {
      consumer.setSampleRate(consumer.sampleRate + 1);
      console.log(
        `[Firehose] Increased sample rate to ${consumer.sampleRate} (${processedPerMinute} msgs/min)`,
      );
    } else if (processedPerMinute < 5000 && consumer.sampleRate > 1) {
      consumer.setSampleRate(consumer.sampleRate - 1);
      console.log(
        `[Firehose] Decreased sample rate to ${consumer.sampleRate} (${processedPerMinute} msgs/min)`,
      );
    }
  }, 60000);

  // Start services
  aggregator.start();

  // Load cached data from DynamoDB before starting consumer
  if (dynamo) {
    aggregator.loadFromDynamo().then(() => {
      consumer.start();
    });
  } else {
    consumer.start();
  }

  // Cleanup function
  const shutdown = () => {
    clearInterval(samplingTimer);
    consumer.stop();
    aggregator.stop();
  };

  return { consumer, aggregator, shutdown };
}

module.exports = { createTrendingService };
