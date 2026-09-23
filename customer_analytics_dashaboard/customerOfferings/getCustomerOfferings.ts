import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  CustomerOfferingRecord,
  GetCustomerOfferingsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getCustomerOfferingsHandler(
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
          offerings: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetCustomerOfferingsResponse),
      };
    }

    const sql = `
      SELECT 
        co.id::text,
        co.customer_id::text,
        co.product_id,
        co.offering_name,
        co.status,
        co.start_date,
        co.end_date,
        co.created_at,
        co.updated_at
      FROM public.customer_offerings co
      WHERE co.customer_id::text = $1
         OR co.customer_id IN (
           SELECT cd.id 
           FROM public.customers_details cd 
           WHERE LOWER(cd.client_user_id) = LOWER($1)
         )
      ORDER BY co.created_at DESC NULLS LAST;
    `;

    const result = await query<CustomerOfferingRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        offerings: result.rows,
        customerOfferings: result.rows,
      } as GetCustomerOfferingsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getCustomerOfferingsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        offerings: [],
        error: error.message || "Failed to retrieve customer offerings",
      } as GetCustomerOfferingsResponse),
    };
  }
}
