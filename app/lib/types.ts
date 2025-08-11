export interface ScrapeJob {
  job_id: string
  source_url: string | null
  status: string | null
  created_at: string
  updated_at: string
  brand_name: string | null
}

export interface Product {
  product_id: number
  product_hash: string | null
  product_data: any
  source_url: string | null
  first_scraped_at: string
  brand_name: string | null
}

export interface Query {
  query_id: number
  product_id: number | null
  query_text: string | null
  query_type: string | null
  is_active: boolean | null
}

export interface LLMTask {
  task_id: string
  job_id: string | null
  query_id: number | null
  llm_model_name: string | null
  status: string | null
  s3_output_path: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface JobSelectedProduct {
  job_id: string
  product_id: number
}

export interface JobWithTasks {
  job: ScrapeJob
  tasks: LLMTask[]
}

export type GroupedResults = Record<string, JobWithTasks>
