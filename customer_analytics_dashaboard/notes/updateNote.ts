import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  NoteRecord,
} from "../types";

export interface UpdateNoteInput {
  title?: string | null;
  content?: string | null;
}

export interface UpdateNoteResponse {
  success: boolean;
  note?: NoteRecord;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "PUT,PATCH,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Lambda handler to UPDATE an existing note in public.notes by ID.
 * 
 * Supports updating title, content, or both.
 */
export async function updateNoteHandler(
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
        } as UpdateNoteResponse),
      };
    }

    if (!isUuid(rawId)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Invalid note ID format: '${rawId}' (must be a valid UUID)`,
        } as UpdateNoteResponse),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body is required",
        } as UpdateNoteResponse),
      };
    }

    let payload: UpdateNoteInput;
    try {
      payload =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON format in request body",
        } as UpdateNoteResponse),
      };
    }

    const { title, content } = payload;

    if (title === undefined && content === undefined) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "At least one field ('title' or 'content') must be provided for update",
        } as UpdateNoteResponse),
      };
    }

    if (content !== undefined && (typeof content !== "string" || !content.trim())) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Field 'content' cannot be empty",
        } as UpdateNoteResponse),
      };
    }

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(title !== null && typeof title === "string" ? title.trim() : null);
    }

    if (content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`);
      params.push(content.trim());
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(rawId);

    const updateSql = `
      UPDATE public.notes
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING 
        id::text,
        customer_id::text,
        title,
        content,
        created_by::text,
        created_at,
        updated_at;
    `;

    const result = await query<NoteRecord>(updateSql, params);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Note not found with ID '${rawId}'`,
        } as UpdateNoteResponse),
      };
    }

    const updatedNote = result.rows[0];

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        note: updatedNote,
      } as UpdateNoteResponse),
    };
  } catch (error: any) {
    console.error("Error executing updateNoteHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to update note",
      } as UpdateNoteResponse),
    };
  }
}
