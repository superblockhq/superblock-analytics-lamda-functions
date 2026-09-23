import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  CustomerDetailsRecord,
  GetCustomerDetailsResponse,
  ListCustomerDetailsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Lambda handler to GET a single customer detail by id (UUID) or client_user_id.
 * Queries the real public.customers_details table.
 */
export async function getCustomerDetailsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const identifier = (
      pathParams.id ||
      pathParams.customerId ||
      params.id ||
      params.customerId ||
      params.clientUserId ||
      ""
    ).trim();

    if (!identifier) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required identifier (customerId or clientUserId)",
        } as GetCustomerDetailsResponse),
      };
    }

    const sql = `
      SELECT 
        id::text,
        client_user_id,
        customer_name,
        email,
        phone,
        status,
        created_at,
        updated_at
      FROM public.customers_details
      WHERE id::text = $1 OR LOWER(client_user_id) = LOWER($1)
      LIMIT 1;
    `;

    const result = await query<CustomerDetailsRecord>(sql, [identifier]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          customer: null,
          error: `Customer not found with identifier: '${identifier}'`,
        } as GetCustomerDetailsResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        customer: result.rows[0],
      } as GetCustomerDetailsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getCustomerDetailsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to retrieve customer details",
      } as GetCustomerDetailsResponse),
    };
  }
}

/**
 * Lambda handler to LIST customer details with pagination.
 * Supports query parameters:
 * - limit: number of rows (default 50, max 100)
 * - offset: number of rows to skip (default 0)
 */
export async function listCustomerDetailsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const limit = Math.min(
      Math.max(1, parseInt(params.limit || "50", 10)),
      100
    );
    const offset = Math.max(0, parseInt(params.offset || "0", 10));

    const sql = `
      SELECT 
        id::text,
        client_user_id,
        customer_name,
        email,
        phone,
        status,
        created_at,
        updated_at
      FROM public.customers_details
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await query<CustomerDetailsRecord>(sql, [limit, offset]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customers: result.rows,
      } as ListCustomerDetailsResponse),
    };
  } catch (error: any) {
    console.error("Error executing listCustomerDetailsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customers: [],
        error: error.message || "Failed to list customer details",
      } as ListCustomerDetailsResponse),
    };
  }
}
