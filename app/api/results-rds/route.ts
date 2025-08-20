import { executeQuery, createApiResponse, createErrorResponse } from "../../lib/api"

export const dynamic = 'force-dynamic'

interface LLMTaskResult {
  task_id: string
  job_id: string | null
  query_id: number | null
  llm_model_name: string | null
  status: string | null
  s3_output_path: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  product_id: number | null
  product_name: string | null
  
  // Joined data
  query_text: string | null
  query_type: string | null
  brand_name: string | null
  product_data: any
}

export async function GET() {
  try {
    const records = await executeQuery(`
      SELECT 
        t.task_id,
        t.job_id,
        t.query_id,
        t.llm_model_name,
        t.status,
        t.s3_output_path,
        t.error_message,
        t.created_at,
        t.completed_at,
        t.product_id,
        t.product_name,
        q.query_text,
        q.query_type,
        p.brand_name,
        p.product_data,
        j.brand_name as job_brand_name
      FROM llmtasks t
      LEFT JOIN queries q ON t.query_id = q.query_id
      LEFT JOIN products p ON t.product_id = p.product_id
      LEFT JOIN scrapejobs j ON t.job_id = j.job_id
      WHERE t.task_id IS NOT NULL
      ORDER BY t.created_at DESC
    `)

    const results = (records as any[]).map((record) => {
      // Extract product name from product_data if not available in product_name column
      let finalProductName = record.product_name
      
      if (!finalProductName && record.product_data) {
        try {
          const data = typeof record.product_data === 'string' 
            ? JSON.parse(record.product_data)
            : record.product_data
          
          finalProductName = data.productname || data.name || data.title || 
                           data.product_name || data.productName || 
                           data.product_title || data.display_name || 
                           data.model || data.variant || null
        } catch (error) {
          console.error("Error parsing product_data:", error)
        }
      }

      // Use job brand_name as fallback if product brand_name is null
      const finalBrandName = record.brand_name || record.job_brand_name

      return {
        task_id: record.task_id,
        job_id: record.job_id,
        query_id: record.query_id,
        llm_model_name: record.llm_model_name,
        status: record.status,
        s3_output_path: record.s3_output_path,
        error_message: record.error_message,
        created_at: record.created_at,
        completed_at: record.completed_at,
        product_id: record.product_id,
        product_name: finalProductName || record.product_id?.toString() || "Unknown Product",
        query_text: record.query_text,
        query_type: record.query_type,
        brand_name: finalBrandName || "Unknown Brand",
        product_data: record.product_data
      } as LLMTaskResult
    })

    return createApiResponse({
      tasks: results,
      total_count: results.length
    })
  } catch (error) {
    console.error("Results RDS API error:", error)
    return createErrorResponse("Failed to fetch RDS-based results")
  }
}
