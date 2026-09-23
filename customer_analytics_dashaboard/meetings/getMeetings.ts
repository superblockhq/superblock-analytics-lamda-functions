import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  MeetingRecord,
  GetMeetingsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Validates whether a string is a standard UUID.
 */
function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

/**
 * Lambda handler to GET meetings for a specific customer.
 * 
 * Supports query parameters:
 * - customerId: UUID of customer or client_user_id
 * - customer_id: alias for customerId
 * 
 * Orders by meeting_date DESC NULLS LAST, with created_at DESC as secondary ordering.
 */
export async function getMeetingsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
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
      const responseBody: GetMeetingsResponse = {
        success: false,
        count: 0,
        customerId: "",
        meetings: [],
        error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
      };
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify(responseBody),
      };
    }

    let meetings: MeetingRecord[] = [];

    if (isUuid(customerId)) {
      // Direct parameterized query by customer_id UUID
      const sql = `
        SELECT 
          id::text,
          customer_id::text,
          title,
          description,
          meeting_date,
          duration_minutes,
          status,
          meeting_url,
          created_by::text,
          created_at,
          updated_at
        FROM public.meetings
        WHERE customer_id = $1
        ORDER BY meeting_date DESC NULLS LAST, created_at DESC;
      `;
      const result = await query<MeetingRecord>(sql, [customerId]);
      meetings = result.rows;
    } else {
      // Parameterized query resolving client_user_id through customers_details
      const sql = `
        SELECT 
          m.id::text,
          m.customer_id::text,
          m.title,
          m.description,
          m.meeting_date,
          m.duration_minutes,
          m.status,
          m.meeting_url,
          m.created_by::text,
          m.created_at,
          m.updated_at
        FROM public.meetings m
        WHERE m.customer_id IN (
          SELECT cd.id 
          FROM public.customers_details cd 
          WHERE LOWER(cd.client_user_id) = LOWER($1)
        )
        ORDER BY m.meeting_date DESC NULLS LAST, m.created_at DESC;
      `;
      const result = await query<MeetingRecord>(sql, [customerId]);
      meetings = result.rows;
    }

    const responseBody: GetMeetingsResponse = {
      success: true,
      count: meetings.length,
      customerId,
      meetings,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.error("Error executing getMeetingsHandler:", error);
    const errorResponse: GetMeetingsResponse = {
      success: false,
      count: 0,
      customerId: "",
      meetings: [],
      error: error.message || "Failed to retrieve customer meetings",
    };
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify(errorResponse),
    };
  }
}
