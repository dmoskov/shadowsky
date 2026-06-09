/**
 * Push token store.
 *
 * Backed by DynamoDB when PUSH_TOKENS_TABLE is set (tokens survive restarts
 * and are shared across ECS tasks); otherwise an in-memory Map with the same
 * async interface (single-instance dev/POC behavior).
 *
 * Records are flat string maps keyed by `did`:
 *   { did, handle?, pushToken, platform?, deviceId?, registeredAt, updatedAt }
 *
 * The DynamoDB table is defined in infra/site/push-tokens.tf.
 */

const {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  ScanCommand,
} = require("@aws-sdk/client-dynamodb");

/**
 * Marshal a flat record of strings to a DynamoDB item.
 * @param {Record<string, string | undefined | null>} record
 * @returns {Record<string, { S: string }>}
 */
function toItem(record) {
  /** @type {Record<string, { S: string }>} */
  const item = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined && value !== null) {
      item[key] = { S: String(value) };
    }
  }
  return item;
}

/**
 * Unmarshal a DynamoDB item back to a flat record of strings.
 * @param {Record<string, { S?: string }>} item
 * @returns {Record<string, string>}
 */
function fromItem(item) {
  /** @type {Record<string, string>} */
  const record = {};
  for (const [key, value] of Object.entries(item)) {
    if (value.S !== undefined) {
      record[key] = value.S;
    }
  }
  return record;
}

class InMemoryPushTokenStore {
  constructor() {
    this.map = new Map();
    this.backend = "memory";
  }

  async set(did, record) {
    this.map.set(did, record);
  }

  async get(did) {
    return this.map.get(did) || null;
  }

  /** @returns {Promise<boolean>} true if a token existed and was deleted */
  async delete(did) {
    return this.map.delete(did);
  }

  async list() {
    return Array.from(this.map.values());
  }

  async count() {
    return this.map.size;
  }
}

class DynamoPushTokenStore {
  constructor(tableName) {
    this.tableName = tableName;
    this.client = new DynamoDBClient({});
    this.backend = "dynamodb";
  }

  async set(did, record) {
    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: toItem({ ...record, did }),
      }),
    );
  }

  async get(did) {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: { did: { S: did } },
      }),
    );
    return result.Item ? fromItem(result.Item) : null;
  }

  /** @returns {Promise<boolean>} true if a token existed and was deleted */
  async delete(did) {
    const result = await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: { did: { S: did } },
        ReturnValues: "ALL_OLD",
      }),
    );
    return !!result.Attributes;
  }

  async list() {
    const records = [];
    let lastKey;
    do {
      const result = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          ExclusiveStartKey: lastKey,
        }),
      );
      for (const item of result.Items || []) {
        records.push(fromItem(item));
      }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    return records;
  }

  async count() {
    return (await this.list()).length;
  }
}

function createPushTokenStore() {
  const tableName = process.env.PUSH_TOKENS_TABLE;
  if (tableName) {
    console.log(`Push tokens: DynamoDB-backed (table: ${tableName})`);
    return new DynamoPushTokenStore(tableName);
  }
  console.log(
    "Push tokens: in-memory (set PUSH_TOKENS_TABLE for a durable, " +
      "multi-instance store — tokens will be lost on restart)",
  );
  return new InMemoryPushTokenStore();
}

module.exports = {
  createPushTokenStore,
  InMemoryPushTokenStore,
  DynamoPushTokenStore,
  toItem,
  fromItem,
};
