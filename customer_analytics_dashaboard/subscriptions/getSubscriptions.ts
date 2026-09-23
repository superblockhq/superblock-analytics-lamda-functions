import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SubscriptionRecord,
  GetSubscriptionsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getSubscriptionsHandler(
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
          subscriptions: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetSubscriptionsResponse),
      };
    }

    const sql = `
      SELECT 
        s.id::text,
        s.customer_id::text,
        s.plan_id::text,
        s.status,
        s.start_date,
        s.end_date,
        s.amount::numeric,
        s.currency,
        s.billing_interval,
        s.created_at,
        s.updated_at,
        p.name as plan_name
      FROM public.subscriptions s
      LEFT JOIN public.plans p ON s.plan_id = p.id
      WHERE s.customer_id::text = $1
         OR s.customer_id IN (
           SELECT cd.id 
           FROM public.customers_details cd 
           WHERE LOWER(cd.client_user_id) = LOWER($1)
         )
      ORDER BY s.created_at DESC NULLS LAST;
    `;

    const result = await query<SubscriptionRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        subscriptions: result.rows,
      } as GetSubscriptionsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getSubscriptionsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        subscriptions: [],
        error: error.message || "Failed to retrieve subscriptions",
      } as GetSubscriptionsResponse),
    };
  }
}
