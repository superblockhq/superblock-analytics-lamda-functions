import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  DealRecord,
  CreateDealInput,
  CreateDealResponse,
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

export async function createDealHandler(
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
        } as CreateDealResponse),
      };
    }

    let payload: CreateDealInput;
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
        } as CreateDealResponse),
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
        } as CreateDealResponse),
      };
    }

    if (!name) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'name' (deal name cannot be empty)",
        } as CreateDealResponse),
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
        } as CreateDealResponse),
      };
    }

    const dealUuid = crypto.randomUUID();
    const dealId = payload.dealId || payload.deal_id || `deal_${dealUuid}`;
    const id = dealId;
    const clientId = payload.clientId || payload.client_id || clientUserId;
    const title = payload.title?.trim() || null;
    const value = typeof payload.value === "number" ? payload.value : 0;
    const numericValue = value;
    const currency = payload.currency?.trim() || "INR";
    const probability = typeof payload.probability === "number" ? payload.probability : 0;
    const forecast = payload.forecast || null;
    const source = payload.source || null;
    const priority = payload.priority || null;
    const pipelineId = payload.pipelineId || payload.pipeline_id || null;
    const pipelineName = payload.pipelineName || payload.pipeline_name || null;
    const stage = payload.stage || null;
    const stageId = payload.stageId || payload.stage_id || null;
    const owner = payload.owner || null;
    const notes = payload.notes || null;
    const dueDate = payload.dueDate || payload.due_date || null;
    const closeDate = payload.closeDate || payload.close_date || null;
    const contact = payload.contact || null;
    const company = payload.company || null;
    const phone = payload.phone || null;
    const status = payload.status || "Open";
    const tags = payload.tags ? JSON.stringify(payload.tags) : "[]";
    const products = payload.products ? JSON.stringify(payload.products) : "[]";
    const ownerId = payload.ownerId || payload.owner_id || null;
    const ownerName = payload.ownerName || payload.owner_name || null;

    const insertSql = `
      INSERT INTO public.deals (
        id, client_id, client_user_id, deal_id, contact, company, phone,
        name, title, value, numeric_value, currency, probability, forecast,
        source, priority, pipeline_id, pipeline_name, stage, stage_id,
        owner, notes, due_date, close_date, activity, created_by,
        created_at, updated_at, tags, products, status, owner_id,
        owner_name, last_activity_at, contact_id, original_value, original_currency
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, NULL, NULL,
        NOW(), NOW(), $25::jsonb, $26::jsonb, $27, $28,
        $29, NOW(), NULL, $30, $31
      )
      RETURNING 
        id, client_id, client_user_id, deal_id, contact, company, phone,
        name, title, value::numeric, numeric_value::numeric, currency,
        probability::numeric, forecast, source, priority, pipeline_id,
        pipeline_name, stage, stage_id, owner, notes, due_date, close_date,
        activity, created_by, created_at, updated_at, tags, products,
        status, owner_id, owner_name, last_activity_at, contact_id,
        original_value::numeric, original_currency;
    `;

    const result = await query<DealRecord>(insertSql, [
      id, clientId, clientUserId, dealId, contact, company, phone,
      name, title, value, numericValue, currency, probability, forecast,
      source, priority, pipelineId, pipelineName, stage, stageId,
      owner, notes, dueDate, closeDate, tags, products, status,
      ownerId, ownerName, value, currency
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        deal: result.rows[0],
      } as CreateDealResponse),
    };
  } catch (error: any) {
    console.error("Error executing createDealHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create deal",
      } as CreateDealResponse),
    };
  }
}
