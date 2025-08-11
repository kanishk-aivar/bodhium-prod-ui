import type { NextRequest } from "next/server"
import { executeQuery, createApiResponse, createErrorResponse } from "../../../lib/api"

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const { jobId } = params

    const records = await executeQuery(
      `
      SELECT q.query_id, q.product_id, q.query_text, q.query_type, q.is_active
      FROM queries q
      JOIN products p ON q.product_id = p.product_id
      JOIN jobselectedproducts jsp ON p.product_id = jsp.product_id
      WHERE jsp.job_id = $1 AND q.is_active = true
      ORDER BY q.query_id DESC
    `,
      [jobId],
    )

    const queries = records.map((record) => ({
      query_id: record.query_id,
      product_id: record.product_id,
      query_text: record.query_text,
      query_type: record.query_type,
      is_active: record.is_active,
    }))

    return createApiResponse(queries)
  } catch (error) {
    console.error("Queries API error:", error)
    return createErrorResponse("Failed to fetch queries")
  }
}
