import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  MeetingRecord,
} from "../types";

export interface UpdateMeetingResponse {
  success: boolean;
  meeting?: MeetingRecord;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "PUT,PATCH,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Lambda handler to UPDATE a meeting in public.meetings by ID.
 */
export async function updateMeetingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const rawId = (
      event.pathParameters?.id ||
      event.queryStringParameters?.id ||
      (event.path ? event.path.split("/").filter(Boolean).pop() : "") ||
      ""
    ).trim();

    if (!rawId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required meeting ID parameter",
        } as UpdateMeetingResponse),
      };
    }

    if (!isUuid(rawId)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Invalid meeting ID format: '${rawId}' (must be a valid UUID)`,
        } as UpdateMeetingResponse),
      };
    }

    let body: any = {};
    if (event.body) {
      try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "Malformed JSON payload",
          } as UpdateMeetingResponse),
        };
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(body.title ? String(body.title).trim() : "Meeting");
    }

    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(body.description !== null ? String(body.description).trim() : null);
    }

    if (body.meetingDate !== undefined || body.meeting_date !== undefined) {
      updates.push(`meeting_date = $${idx++}`);
      values.push(body.meetingDate || body.meeting_date || null);
    }

    if (body.durationMinutes !== undefined || body.duration_minutes !== undefined) {
      updates.push(`duration_minutes = $${idx++}`);
      values.push(Number(body.durationMinutes ?? body.duration_minutes) || null);
    }

    if (body.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(String(body.status).trim());
    }

    if (body.meetingUrl !== undefined || body.meeting_url !== undefined) {
      updates.push(`meeting_url = $${idx++}`);
      values.push(body.meetingUrl || body.meeting_url || null);
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "No valid fields provided to update",
        } as UpdateMeetingResponse),
      };
    }

    updates.push(`updated_at = NOW()`);
    values.push(rawId);

    const updateSql = `
      UPDATE public.meetings
      SET ${updates.join(", ")}
      WHERE id::text = $${idx}
      RETURNING 
        id::text,
        customer_id::text,
        title,
        description,
        meeting_date,
        duration_minutes,
        status,
        meeting_url,
        created_by::text,
        created_at,
        updated_at;
    `;

    const result = await query<MeetingRecord>(updateSql, values);

    if (result.rowCount === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Meeting with ID '${rawId}' not found`,
        } as UpdateMeetingResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        meeting: result.rows[0],
      } as UpdateMeetingResponse),
    };
  } catch (error: any) {
    console.error("Error executing updateMeetingHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to update meeting",
      } as UpdateMeetingResponse),
    };
  }
}
