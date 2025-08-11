import type { NextRequest } from "next/server"
import { executeQuery, createApiResponse, createErrorResponse } from "../../../lib/api"

type QueryRow = {
  query_id: number
  product_id: number | null
  query_text: string | null
  query_type: string | null
  is_active: boolean
}

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

    const queries = (records as QueryRow[]).map((record) => ({
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

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    // jobId is kept in the route for compatibility, but queries are now fetched by product_ids
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { jobId } = params

    const body = await request.json()
    const productIds: number[] = Array.isArray(body?.product_ids) ? body.product_ids : []

    if (!productIds || productIds.length === 0) {
      return createErrorResponse("product_ids is required and must be a non-empty array", 400)
    }

    // Build a parameterized IN clause: $1, $2, ...
    const placeholders = productIds.map((_, idx) => `$${idx + 1}`).join(", ")

    const records = await executeQuery(
      `
      SELECT q.query_id, q.product_id, q.query_text, q.query_type, q.is_active
      FROM queries q
      WHERE q.is_active = true AND q.product_id IN (${placeholders})
      ORDER BY q.query_id DESC
    `,
      productIds,
    )

    const queries = (records as QueryRow[]).map((record) => ({
      query_id: record.query_id,
      product_id: record.product_id,
      query_text: record.query_text,
      query_type: record.query_type,
      is_active: record.is_active,
    }))

    return createApiResponse(queries)
  } catch (error) {
    console.error("Queries API POST error:", error)
    return createErrorResponse("Failed to fetch queries for products")
  }
}
