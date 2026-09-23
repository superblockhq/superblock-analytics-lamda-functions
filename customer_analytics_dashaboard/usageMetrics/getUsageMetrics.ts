import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  UsageMetricRecord,
  GetUsageMetricsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getUsageMetricsHandler(
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
          usageMetrics: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetUsageMetricsResponse),
      };
    }

    const sql = `
      SELECT 
        um.id::text,
        um.customer_id::text,
        um.metric_name,
        um.metric_value::numeric,
        um.metric_unit,
        um.recorded_at,
        um.created_at
      FROM public.usage_metrics um
      WHERE um.customer_id::text = $1
         OR um.customer_id IN (
           SELECT cd.id 
           FROM public.customers_details cd 
           WHERE LOWER(cd.client_user_id) = LOWER($1)
         )
      ORDER BY um.recorded_at DESC NULLS LAST, um.created_at DESC NULLS LAST;
    `;

    const result = await query<UsageMetricRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        usageMetrics: result.rows,
      } as GetUsageMetricsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getUsageMetricsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        usageMetrics: [],
        error: error.message || "Failed to retrieve usage metrics",
      } as GetUsageMetricsResponse),
    };
  }
}
