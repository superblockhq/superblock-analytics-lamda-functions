import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ProductRecord,
  GetProductsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getProductsHandler(
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
          products: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetProductsResponse),
      };
    }

    const sql = `
      SELECT 
        id, client_id, client_user_id, name, description, category, hsn,
        barcode_type, barcode_value, billing, cost::numeric, currency,
        active, created_by, created_at, updated_at, price::numeric,
        sku, margin, tax_rate::numeric, unit, track_inventory, stock::numeric
      FROM public.products
      WHERE LOWER(client_user_id) = LOWER($1)
         OR client_id = $1
         OR client_user_id IN (
           SELECT cd.client_user_id 
           FROM public.customers_details cd 
           LEFT JOIN public.users u ON (
             LOWER(cd.client_user_id) = LOWER(u.user_name) 
             OR LOWER(cd.client_user_id) = LOWER(u.email) 
             OR LOWER(cd.client_user_id) = LOWER(u.user_email)
             OR LOWER(cd.client_user_id) = LOWER(u.user_id::text)
           )
           WHERE cd.id::text = $1 
              OR LOWER(cd.client_user_id) = LOWER($1)
              OR u.user_id::text = $1
         )
         OR LOWER(client_user_id) IN (
           SELECT LOWER(u.user_name)
           FROM public.users u
           WHERE u.user_id::text = $1
              OR LOWER(u.user_email) = LOWER($1)
              OR LOWER(u.email) = LOWER($1)
         )
      ORDER BY created_at DESC;
    `;

    const result = await query<ProductRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        products: result.rows,
      } as GetProductsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getProductsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        products: [],
        error: error.message || "Failed to retrieve products",
      } as GetProductsResponse),
    };
  }
}
