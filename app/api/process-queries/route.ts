import type { NextRequest } from "next/server"
import { invokeLambda, LAMBDA_ARNS, executeQuery, createApiResponse, createErrorResponse } from "../../lib/api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, query_ids } = body

    if (!job_id || !query_ids || query_ids.length === 0) {
      return createErrorResponse("Job ID and query IDs are required", 400)
    }

    // Get query texts
    const queryRecords = await executeQuery(
      `
      SELECT query_text
      FROM queries
      WHERE query_id = ANY($1)
    `,
      [query_ids],
    )

    const queries = queryRecords.map((record) => record.query_text).filter(Boolean)

    // Invoke LLM orchestrator lambda
    const result = await invokeLambda(LAMBDA_ARNS.LLM_ORCHESTRATOR, {
      body: {
        queries,
        job_id,
        options: {
          models: ["chatgpt", "perplexity", "aimode", "aioverview"],
          async: true,
        },
      },
    })

    if (result.statusCode === 202 || result.statusCode === 200) {
      return createApiResponse({
        message: "Query processing started",
        job_id,
        queries_count: queries.length,
      })
    } else {
      return createErrorResponse(result.body?.error || "Query processing failed", result.statusCode)
    }
  } catch (error) {
    console.error("Process queries API error:", error)
    return createErrorResponse("Internal server error")
  }
}
