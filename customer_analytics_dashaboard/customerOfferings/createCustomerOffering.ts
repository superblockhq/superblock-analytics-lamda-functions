import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  CustomerOfferingRecord,
  CreateCustomerOfferingInput,
  CreateCustomerOfferingResponse,
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

export async function createCustomerOfferingHandler(
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
        } as CreateCustomerOfferingResponse),
      };
    }

    let payload: CreateCustomerOfferingInput;
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
        } as CreateCustomerOfferingResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();

    const productId = payload.productId || payload.product_id || null;
    const offeringName = (payload.offeringName || payload.offering_name || "").trim() || null;

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateCustomerOfferingResponse),
      };
    }

    if (!offeringName && !productId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Either 'offeringName' or 'productId' is required",
        } as CreateCustomerOfferingResponse),
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
        } as CreateCustomerOfferingResponse),
      };
    }

    // If productId is supplied, verify it exists in public.products
    let resolvedOfferingName = offeringName;
    if (productId) {
      const prodCheck = await query<{ id: string; name: string }>(
        "SELECT id, name FROM public.products WHERE id = $1 LIMIT 1;",
        [productId]
      );
      if (prodCheck.rows.length === 0) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Product not found for ID: '${productId}'`,
          } as CreateCustomerOfferingResponse),
        };
      }
      if (!resolvedOfferingName) {
        resolvedOfferingName = prodCheck.rows[0].name;
      }
    }

    const status = payload.status || "active";
    const startDate = payload.startDate || payload.start_date || null;
    const endDate = payload.endDate || payload.end_date || null;

    const insertSql = `
      INSERT INTO public.customer_offerings (
        id, customer_id, product_id, offering_name, status,
        start_date, end_date, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, NOW(), NOW()
      )
      RETURNING 
        id::text, customer_id::text, product_id, offering_name, status,
        start_date, end_date, created_at, updated_at;
    `;

    const result = await query<CustomerOfferingRecord>(insertSql, [
      customerUuid, productId, resolvedOfferingName, status, startDate, endDate
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        offering: result.rows[0],
        customerOffering: result.rows[0],
      } as CreateCustomerOfferingResponse),
    };
  } catch (error: any) {
    console.error("Error executing createCustomerOfferingHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create customer offering",
      } as CreateCustomerOfferingResponse),
    };
  }
}
