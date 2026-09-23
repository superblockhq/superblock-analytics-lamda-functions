import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  NoteRecord,
  CreateNoteInput,
  CreateNoteResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

/**
 * Resolves a customer identifier (UUID or client_user_id) into a confirmed customer UUID.
 */
async function resolveCustomerUuid(identifier: string): Promise<string | null> {
  const sql = `
    SELECT c.id::text 
    FROM public.customers_details c
    LEFT JOIN public.users u ON (
      LOWER(c.client_user_id) = LOWER(u.user_name) 
      OR LOWER(c.client_user_id) = LOWER(u.email) 
      OR LOWER(c.client_user_id) = LOWER(u.user_email)
      OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
    )
    WHERE c.id::text = $1 
       OR LOWER(c.client_user_id) = LOWER($1)
       OR u.user_id::text = $1
    LIMIT 1;
  `;
  const res = await query<{ id: string }>(sql, [identifier]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

/**
 * Lambda handler to INSERT a new note into public.notes.
 * 
 * Expected JSON body:
 * {
 *   "customerId": "uuid or client_user_id",
 *   "title": "Optional title string",
 *   "content": "Note content text (required)",
 *   "createdBy": "Optional author UUID"
 * }
 */
export async function createNoteHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: CreateNoteInput;

    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body is required",
        } as CreateNoteResponse),
      };
    }

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
        } as CreateNoteResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();
    const title = payload.title?.trim() || null;
    const content = payload.content?.trim() || "";
    const rawCreatedBy = (payload.createdBy || payload.created_by || "").trim();

    // 1. Validation
    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateNoteResponse),
      };
    }

    if (!content) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'content' (note body cannot be empty)",
        } as CreateNoteResponse),
      };
    }

    // 2. Resolve customer_id to authoritative customers_details.id UUID
    const customerUuid = await resolveCustomerUuid(rawCustomerId);
    if (!customerUuid) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateNoteResponse),
      };
    }

    // 3. Handle created_by UUID validation
    const createdByUuid =
      rawCreatedBy && isUuid(rawCreatedBy) ? rawCreatedBy : null;

    // 4. Parameterized INSERT statement
    const insertSql = `
      INSERT INTO public.notes (
        customer_id,
        title,
        content,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, NOW(), NOW()
      )
      RETURNING 
        id::text,
        customer_id::text,
        title,
        content,
        created_by::text,
        created_at,
        updated_at;
    `;

    const result = await query<NoteRecord>(insertSql, [
      customerUuid,
      title,
      content,
      createdByUuid,
    ]);

    const createdNote = result.rows[0];

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        note: createdNote,
      } as CreateNoteResponse),
    };
  } catch (error: any) {
    console.error("Error executing createNoteHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create note",
      } as CreateNoteResponse),
    };
  }
}
