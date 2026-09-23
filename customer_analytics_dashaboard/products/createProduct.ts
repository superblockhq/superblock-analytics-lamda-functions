import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ProductRecord,
  CreateProductInput,
  CreateProductResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

async function resolveClientUserId(identifier: string): Promise<string | null> {
  const sql = `
    SELECT client_user_id 
    FROM public.customers_details 
    WHERE id::text = $1 OR LOWER(client_user_id) = LOWER($1)
    LIMIT 1;
  `;
  const res = await query<{ client_user_id: string }>(sql, [identifier]);
  return res.rows.length > 0 ? res.rows[0].client_user_id : null;
}

export async function createProductHandler(
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
        } as CreateProductResponse),
      };
    }

    let payload: CreateProductInput;
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
        } as CreateProductResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.clientUserId ||
      payload.client_user_id ||
      payload.clientId ||
      payload.client_id ||
      ""
    ).trim();

    const name = (payload.name || "").trim();

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateProductResponse),
      };
    }

    if (!name) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'name'",
        } as CreateProductResponse),
      };
    }

    const clientUserId = await resolveClientUserId(rawCustomerId);
    if (!clientUserId) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateProductResponse),
      };
    }

    const randStr = crypto.randomBytes(3).toString("hex");
    const id = payload.id || `prod_${Date.now()}_${randStr}`;
    const clientId = payload.clientId || payload.client_id || clientUserId;
    const description = payload.description || "";
    const category = payload.category || "General";
    const hsn = payload.hsn || null;
    const barcodeType = payload.barcodeType || payload.barcode_type || null;
    const barcodeValue = payload.barcodeValue || payload.barcode_value || null;
    const billing = payload.billing || null;
    const cost = typeof payload.cost === "number" ? payload.cost : 0;
    const currency = payload.currency || "INR";
    const active = payload.active ?? true;
    const price = typeof payload.price === "number" ? payload.price : 0;
    const sku = payload.sku || null;
    const margin = payload.margin || null;
    const taxRate = typeof payload.taxRate === "number" ? payload.taxRate : (typeof payload.tax_rate === "number" ? payload.tax_rate : 18);
    const unit = payload.unit || "unit";
    const trackInventory = payload.trackInventory ?? payload.track_inventory ?? false;
    const stock = typeof payload.stock === "number" ? payload.stock : 0;
    const createdBy = payload.createdBy || payload.created_by || null;

    const insertSql = `
      INSERT INTO public.products (
        id, client_id, client_user_id, name, description, category, hsn,
        barcode_type, barcode_value, billing, cost, currency, active,
        created_by, created_at, updated_at, price, sku, margin, tax_rate,
        unit, track_inventory, stock
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, NOW(), NOW(), $15, $16, $17, $18,
        $19, $20, $21
      )
      RETURNING 
        id, client_id, client_user_id, name, description, category, hsn,
        barcode_type, barcode_value, billing, cost::numeric, currency, active,
        created_by, created_at, updated_at, price::numeric, sku, margin,
        tax_rate::numeric, unit, track_inventory, stock::numeric;
    `;

    const result = await query<ProductRecord>(insertSql, [
      id, clientId, clientUserId, name, description, category, hsn,
      barcodeType, barcodeValue, billing, cost, currency, active,
      createdBy, price, sku, margin, taxRate, unit, trackInventory, stock
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        product: result.rows[0],
      } as CreateProductResponse),
    };
  } catch (error: any) {
    console.error("Error executing createProductHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create product",
      } as CreateProductResponse),
    };
  }
}
