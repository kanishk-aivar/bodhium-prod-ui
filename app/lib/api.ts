import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda"
import { Pool } from "pg"

// AWS Configuration - Uses IAM Task Role when running in ECS
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
  // No explicit credentials - uses default credential provider chain
  // This will automatically use:
  // 1. ECS Task Role (when running in ECS)
  // 2. EC2 Instance Profile (when running on EC2)  
  // 3. Environment variables (when running locally)
})

// Lambda ARNs from environment variables
export const LAMBDA_ARNS = {
  WEBSCRAPPER: process.env.LAMBDA_WEBSCRAPPER_ARN!,
  QUERY_GENERATOR: process.env.LAMBDA_QUERY_GENERATOR_ARN!,
  LLM_ORCHESTRATOR: process.env.LAMBDA_LLM_ORCHESTRATOR_ARN!,
}

// PostgreSQL Connection Pool
let pool: Pool | null = null

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.RDS_HOST,
      port: Number.parseInt(process.env.RDS_PORT || "5432"),
      database: process.env.RDS_DATABASE,
      user: process.env.RDS_USERNAME,
      password: process.env.RDS_PASSWORD,
      ssl: {
        rejectUnauthorized: false, // For AWS RDS
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }
  return pool
}

// Lambda Invocation Helper
export async function invokeLambda(functionName: string, payload: any) {
  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
      InvocationType: "RequestResponse",
    })

    const response = await lambdaClient.send(command)

    if (response.Payload) {
      const result = JSON.parse(new TextDecoder().decode(response.Payload))
      return result
    }

    throw new Error("No response from Lambda function")
  } catch (error) {
    console.error("Lambda invocation error:", error)
    throw error
  }
}

// Database Query Helper
export async function executeQuery(sql: string, parameters: any[] = []) {
  const client = getPool()
  try {
    const result = await client.query(sql, parameters)
    return result.rows
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

// API Response Helper
export function createApiResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export function createErrorResponse(message: string, status = 500) {
  return createApiResponse({ error: message }, status)
}
