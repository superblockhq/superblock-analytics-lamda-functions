import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "../types";

export interface DeleteMeetingResponse {
  success: boolean;
  id?: string;
  customerId?: string;
  message?: string;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Lambda handler to DELETE a meeting from public.meetings by ID.
 */
export async function deleteMeetingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const rawId = (
      event.pathParameters?.id ||
      event.queryStringParameters?.id ||
      (event.path ? event.path.split("/").filter(Boolean).pop() : "") ||
      ""
    ).trim();

    if (!rawId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required meeting ID parameter",
        } as DeleteMeetingResponse),
      };
    }

    if (!isUuid(rawId)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Invalid meeting ID format: '${rawId}' (must be a valid UUID)`,
        } as DeleteMeetingResponse),
      };
    }

    const deleteSql = `
      DELETE FROM public.meetings
      WHERE id::text = $1
      RETURNING id::text, customer_id::text;
    `;

    const result = await query<{ id: string; customer_id: string }>(deleteSql, [rawId]);

    if (result.rowCount === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          id: rawId,
          error: `Meeting with ID '${rawId}' not found`,
        } as DeleteMeetingResponse),
      };
    }

    const deletedRecord = result.rows[0];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: deletedRecord.id,
        customerId: deletedRecord.customer_id,
        message: "Meeting deleted successfully",
      } as DeleteMeetingResponse),
    };
  } catch (error: any) {
    console.error("Error executing deleteMeetingHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete meeting",
      } as DeleteMeetingResponse),
    };
  }
}
