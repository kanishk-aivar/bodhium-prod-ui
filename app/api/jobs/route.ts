import { executeQuery, createApiResponse, createErrorResponse } from "../../lib/api"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const records = await executeQuery(`
      SELECT job_id, source_url, status, created_at, updated_at, brand_name, progress
      FROM scrapejobs
      ORDER BY created_at DESC
      LIMIT 50
    `)

    const jobs = records.map((record) => ({
      job_id: record.job_id,
      source_url: record.source_url,
      status: record.status,
      created_at: record.created_at,
      updated_at: record.updated_at,
      brand_name: record.brand_name,
      progress: record.progress,
    }))

    return createApiResponse(jobs)
  } catch (error) {
    console.error("Jobs API error:", error)
    return createErrorResponse("Failed to fetch jobs")
  }
}
