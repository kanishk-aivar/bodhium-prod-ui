import type { NextRequest } from "next/server"
import { invokeLambda, LAMBDA_ARNS, executeQuery, createApiResponse, createErrorResponse } from "../../lib/api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, product_ids } = body

    if (!job_id || !product_ids || product_ids.length === 0) {
      return createErrorResponse("Job ID and product IDs are required", 400)
    }

    // Get product details
    const productRecords = await executeQuery(
      `
      SELECT product_id, product_data, brand_name
      FROM products
      WHERE product_id = ANY($1)
    `,
      [product_ids],
    )

    const products = productRecords.map((record) => {
      let productData = record.product_data
      if (typeof productData === "string") {
        try {
          productData = JSON.parse(productData)
        } catch {
          productData = {}
        }
      }

      return {
        product_id: record.product_id, // Include product_id as requested
        name: productData?.productname || productData?.name || productData?.title || "Unknown Product", // Fix: Use productname
        brand: record.brand_name || "Unknown Brand",
      }
    })

    // Invoke query generator lambda
    const result = await invokeLambda(LAMBDA_ARNS.QUERY_GENERATOR, {
      body: {
        job_id,
        products,
        num_questions: 25,
      },
    })

    if (result.statusCode === 200) {
      return createApiResponse({ message: "Query generation started", job_id })
    } else {
      return createErrorResponse(result.body?.error || "Query generation failed", result.statusCode)
    }
  } catch (error) {
    console.error("Generate queries API error:", error)
    return createErrorResponse("Internal server error")
  }
}
