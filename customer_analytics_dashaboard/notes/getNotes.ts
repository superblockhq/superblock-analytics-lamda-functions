import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  NoteRecord,
  GetNotesResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};



/**
 * Lambda handler to GET notes for a specific customer.
 * 
 * Supports query parameters:
 * - customerId: UUID of customer or client_user_id
 * - customer_id: alias for customerId
 */
export async function getNotesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer identifier from queryStringParameters or pathParameters
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!customerId) {
      const responseBody: GetNotesResponse = {
        success: false,
        count: 0,
        customerId: "",
        notes: [],
        error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
      };
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify(responseBody),
      };
    }

    let notes: NoteRecord[] = [];

    // Parameterized query resolving customers_details.id, client_user_id, or Cognito user_id
    const sql = `
      SELECT 
        n.id::text,
        n.customer_id::text,
        n.title,
        n.content,
        n.created_by::text,
        n.created_at,
        n.updated_at
      FROM public.notes n
      WHERE n.customer_id::text = $1
         OR n.customer_id IN (
           SELECT c.id 
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
         )
      ORDER BY n.created_at DESC;
    `;
    const result = await query<NoteRecord>(sql, [customerId]);
    notes = result.rows;

    const responseBody: GetNotesResponse = {
      success: true,
      count: notes.length,
      customerId,
      notes,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.error("Error executing getNotesHandler:", error);
    const errorResponse: GetNotesResponse = {
      success: false,
      count: 0,
      customerId: "",
      notes: [],
      error: error.message || "Failed to retrieve customer notes",
    };
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify(errorResponse),
    };
  }
}
