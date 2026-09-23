import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  NoteRecord,
} from "../types";

export interface DeleteNoteResponse {
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
 * Lambda handler to DELETE a note from public.notes by ID.
 */
export async function deleteNoteHandler(
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
          error: "Missing required note ID parameter",
        } as DeleteNoteResponse),
      };
    }

    if (!isUuid(rawId)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Invalid note ID format: '${rawId}' (must be a valid UUID)`,
        } as DeleteNoteResponse),
      };
    }

    const deleteSql = `
      DELETE FROM public.notes
      WHERE id = $1
      RETURNING id::text, customer_id::text;
    `;

    const result = await query<{ id: string; customer_id: string }>(deleteSql, [rawId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Note not found with ID '${rawId}'`,
        } as DeleteNoteResponse),
      };
    }

    const deleted = result.rows[0];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: deleted.id,
        customerId: deleted.customer_id,
        message: "Note deleted successfully",
      } as DeleteNoteResponse),
    };
  } catch (error: any) {
    console.error("Error executing deleteNoteHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete note",
      } as DeleteNoteResponse),
    };
  }
}
