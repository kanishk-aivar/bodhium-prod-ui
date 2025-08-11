import type { NextRequest } from "next/server"
import { invokeLambda, LAMBDA_ARNS, createApiResponse, createErrorResponse } from "../../lib/api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return createErrorResponse("URL is required", 400)
    }

    // Invoke the web scraper lambda
    const result = await invokeLambda(LAMBDA_ARNS.WEBSCRAPPER, {
      body: {
        url,
        brand_name: new URL(url).hostname,
      },
    })

    if (result.statusCode === 200) {
      return createApiResponse(JSON.parse(result.body))
    } else {
      return createErrorResponse(result.body?.error || "Scraping failed", result.statusCode)
    }
  } catch (error) {
    console.error("Scrape API error:", error)
    return createErrorResponse("Internal server error")
  }
}
