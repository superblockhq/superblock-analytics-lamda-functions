import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ActivityRecord,
  CreateActivityInput,
  CreateActivityResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

async function resolveCustomerUuid(identifier: string): Promise<string | null> {
  const sql = `
    SELECT id::text 
    FROM public.customers_details 
    WHERE id::text = $1 OR LOWER(client_user_id) = LOWER($1)
    LIMIT 1;
  `;
  const res = await query<{ id: string }>(sql, [identifier]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

export async function createActivityHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body is required",
        } as CreateActivityResponse),
      };
    }

    let payload: CreateActivityInput;
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
        } as CreateActivityResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();

    const activityType = (
      payload.activityType ||
      payload.activity_type ||
      ""
    ).trim();

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateActivityResponse),
      };
    }

    if (!activityType) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'activityType'",
        } as CreateActivityResponse),
      };
    }

    const customerUuid = await resolveCustomerUuid(rawCustomerId);
    if (!customerUuid) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateActivityResponse),
      };
    }

    const title = payload.title?.trim() || null;
    const description = payload.description?.trim() || null;
    const rawPerformedBy = (payload.performedBy || payload.performed_by)?.trim() || null;
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const performedBy = rawPerformedBy && isUuid(rawPerformedBy) ? rawPerformedBy : null;
    const rawActivityDate = payload.activityDate || payload.activity_date || null;
    let activityDate = null;
    if (rawActivityDate) {
      const parsed = new Date(rawActivityDate);
      if (!isNaN(parsed.getTime())) {
        activityDate = parsed.toISOString();
      }
    }

    const insertSql = `
      INSERT INTO public.activities (
        id, customer_id, activity_type, title, description,
        performed_by, activity_date, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, COALESCE($6::timestamptz, NOW()), NOW()
      )
      RETURNING 
        id::text, customer_id::text, activity_type, title,
        description, performed_by, activity_date, created_at;
    `;

    const result = await query<ActivityRecord>(insertSql, [
      customerUuid, activityType, title, description, performedBy, activityDate
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        activity: result.rows[0],
      } as CreateActivityResponse),
    };
  } catch (error: any) {
    console.error("Error executing createActivityHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create activity",
      } as CreateActivityResponse),
    };
  }
}
