import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ActivityRecord,
  GetActivitiesResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getActivitiesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      params.clientUserId ||
      params.client_user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!customerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          count: 0,
          customerId: "",
          activities: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetActivitiesResponse),
      };
    }

    const sql = `
      SELECT 
        a.id::text,
        a.customer_id::text,
        a.activity_type,
        a.title,
        a.description,
        a.performed_by,
        a.activity_date,
        a.created_at
      FROM public.activities a
      WHERE a.customer_id::text = $1
         OR a.customer_id IN (
           SELECT cd.id 
           FROM public.customers_details cd 
           WHERE LOWER(cd.client_user_id) = LOWER($1)
         )
      ORDER BY a.activity_date DESC NULLS LAST, a.created_at DESC NULLS LAST;
    `;

    const result = await query<ActivityRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        activities: result.rows,
      } as GetActivitiesResponse),
    };
  } catch (error: any) {
    console.error("Error executing getActivitiesHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        activities: [],
        error: error.message || "Failed to retrieve activities",
      } as GetActivitiesResponse),
    };
  }
}
