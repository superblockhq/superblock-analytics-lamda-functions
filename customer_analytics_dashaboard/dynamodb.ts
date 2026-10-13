import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let cachedClient: DynamoDBClient | null = null;
let cachedDocClient: DynamoDBDocumentClient | null = null;

/**
 * Returns a cached AWS DynamoDB Client configured for the target AWS region.
 * Uses standard AWS IAM execution role in AWS Lambda or ambient environment credentials.
 * Never hardcodes credentials or exposes secrets.
 */
export function getDynamoClient(): DynamoDBClient {
  if (!cachedClient) {
    const region = process.env.AWS_REGION || "ap-south-1";
    cachedClient = new DynamoDBClient({
      region,
    });
  }
  return cachedClient;
}

/**
 * Returns a cached DynamoDB Document Client with automatic marshaling/unmarshaling.
 */
export function getDynamoDocClient(): DynamoDBDocumentClient {
  if (!cachedDocClient) {
    const client = getDynamoClient();
    cachedDocClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  return cachedDocClient;
}

/**
 * Resolves the DynamoDB table name for Messages from environment variables.
 * Defaults to "Messages".
 */
export function getMessagesTableName(): string {
  return (
    process.env.DYNAMODB_MESSAGES_TABLE ||
    process.env.MESSAGES_TABLE_NAME ||
    "Messages"
  );
}

/**
 * Resolves the optional Global Secondary Index (GSI) name from environment variables.
 * Returns null if no GSI has been configured.
 */
export function getMessagesIndexName(): string | null {
  return (
    process.env.DYNAMODB_MESSAGES_INDEX_NAME ||
    process.env.MESSAGES_GSI_NAME ||
    process.env.MESSAGES_INDEX_NAME ||
    null
  );
}

/**
 * Resolves the partition key attribute name of the GSI.
 * Defaults to "client#user_id" if an index is configured.
 */
export function getMessagesIndexKey(): string {
  return (
    process.env.DYNAMODB_MESSAGES_INDEX_KEY ||
    "client#user_id"
  );
}
