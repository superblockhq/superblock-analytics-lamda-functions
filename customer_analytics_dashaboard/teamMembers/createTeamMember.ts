import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  TeamMemberRecord,
  CreateTeamMemberInput,
  CreateTeamMemberResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

async function resolveOrgUser(identifier: string): Promise<{ orgUserId: string; orgUserName: string | null } | null> {
  const sql = `
    SELECT client_user_id, customer_name 
    FROM public.customers_details 
    WHERE id::text = $1 OR LOWER(client_user_id) = LOWER($1)
    LIMIT 1;
  `;
  const res = await query<{ client_user_id: string; customer_name: string | null }>(sql, [identifier]);
  if (res.rows.length > 0) {
    return {
      orgUserId: res.rows[0].client_user_id,
      orgUserName: res.rows[0].customer_name,
    };
  }
  return null;
}

export async function createTeamMemberHandler(
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
        } as CreateTeamMemberResponse),
      };
    }

    let payload: CreateTeamMemberInput;
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
        } as CreateTeamMemberResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.orgUserId ||
      payload.org_user_id ||
      ""
    ).trim();
    const name = (payload.name || "").trim();
    const email = (payload.email || "").trim().toLowerCase();

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateTeamMemberResponse),
      };
    }

    if (!name) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'name'",
        } as CreateTeamMemberResponse),
      };
    }

    if (!email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'email'",
        } as CreateTeamMemberResponse),
      };
    }

    const resolved = await resolveOrgUser(rawCustomerId);
    if (!resolved) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateTeamMemberResponse),
      };
    }

    const orgUserId = resolved.orgUserId;
    const orgUserName = payload.orgUserName || payload.org_user_name || resolved.orgUserName;
    const teamUserId = payload.teamUserId || payload.team_user_id || `tm_${crypto.randomUUID().slice(0, 8)}`;
    const avatarUrl = payload.avatarUrl || payload.avatar_url || null;
    const role = payload.role || "Agent";
    const passwordHash = payload.passwordHash || payload.password_hash || null;

    const insertSql = `
      INSERT INTO public.team_members (
        id, team_user_id, org_user_id, org_user_name, name, email,
        avatar_url, role, password_hash, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8, NOW()
      )
      RETURNING 
        id::text, team_user_id, org_user_id, org_user_name, name, email,
        avatar_url, role, password_hash, created_at;
    `;

    const result = await query<TeamMemberRecord>(insertSql, [
      teamUserId, orgUserId, orgUserName, name, email,
      avatarUrl, role, passwordHash
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        teamMember: result.rows[0],
      } as CreateTeamMemberResponse),
    };
  } catch (error: any) {
    console.error("Error executing createTeamMemberHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create team member",
      } as CreateTeamMemberResponse),
    };
  }
}
