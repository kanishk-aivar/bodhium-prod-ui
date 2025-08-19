import type { NextRequest } from "next/server"
import { invokeLambda, LAMBDA_ARNS, executeQuery, createApiResponse, createErrorResponse } from "../../lib/api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, query_ids } = body

    if (!job_id || !query_ids || query_ids.length === 0) {
      return createErrorResponse("Job ID and query IDs are required", 400)
    }

    // Get query texts and their associated product_ids
    const queryRecords = await executeQuery(
      `
      SELECT query_id, query_text, product_id
      FROM queries
      WHERE query_id = ANY($1)
    `,
      [query_ids],
    )

    // Group queries by product_id in the new format
    const selectedQueries = new Map<string, string[]>()
    
    for (const record of queryRecords) {
      if (!record.query_text) continue
      
      const productId = record.product_id?.toString() || "unknown"
      
      if (!selectedQueries.has(productId)) {
        selectedQueries.set(productId, [])
      }
      
      selectedQueries.get(productId)!.push(record.query_text)
    }

    // Convert to the new format
    const selectedQueriesArray = Array.from(selectedQueries.entries()).map(([productId, queries]) => ({
      product_id: productId,
      queries: queries
    }))

    // Invoke LLM orchestrator lambda with new format
    const result = await invokeLambda(LAMBDA_ARNS.LLM_ORCHESTRATOR, {
      body: {
        job_id,
        selected_queries: selectedQueriesArray,
        options: {
          models: ["chatgpt", "perplexity", "aimode", "aioverview"],
          async: true,
          priority: "high",
          timeout: 300
        },
      },
    })

    if (result.statusCode === 202 || result.statusCode === 200) {
      return createApiResponse({
        message: "Query processing started",
        job_id,
        products_count: selectedQueriesArray.length,
        total_queries: queryRecords.length,
      })
    } else {
      return createErrorResponse(result.body?.error || "Query processing failed", result.statusCode)
    }
  } catch (error) {
    console.error("Process queries API error:", error)
    return createErrorResponse("Internal server error")
  }
}
