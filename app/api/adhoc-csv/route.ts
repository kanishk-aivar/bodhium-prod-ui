import { NextRequest, NextResponse } from "next/server"
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
})

const LAMBDA_ARN = process.env.LAMBDA_LLM_ADHOC_ORCHESTRATOR_ARN
const S3_ADHOC_DOWNLOAD_BUCKET = process.env.S3_ADHOC_DOWNLOAD_BUCKET

interface LambdaResponse {
  status: string
  job_id: string
  summary: {
    total_records: number
    completed_tasks: number
    failed_tasks: number
    total_tasks: number
    success_rate: number
  }
  content_analysis?: any
  csv_details: {
    generated: boolean
    s3_location: string
    filename: string
    size_info: string
    analysis_columns_added?: string[]
  }
  download?: {
    presigned_url: string
    expires_in: string
    direct_download: boolean
  }
  generated_at: string
  processing_complete: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { job_id, action } = await request.json()

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      )
    }

    if (!LAMBDA_ARN) {
      return NextResponse.json(
        { error: 'Lambda ARN not configured' },
        { status: 500 }
      )
    }

    // Call Lambda function to generate/get CSV
    const lambdaCommand = new InvokeCommand({
      FunctionName: LAMBDA_ARN,
      Payload: JSON.stringify({ job_id }),
    })

    const lambdaResponse = await lambdaClient.send(lambdaCommand)
    
    if (!lambdaResponse.Payload) {
      throw new Error('No payload returned from Lambda')
    }

    const responseText = new TextDecoder().decode(lambdaResponse.Payload)
    const lambdaResult = JSON.parse(responseText)

    // Parse the body if it's a string (typical Lambda response format)
    let parsedBody: LambdaResponse
    if (typeof lambdaResult.body === 'string') {
      parsedBody = JSON.parse(lambdaResult.body)
    } else {
      parsedBody = lambdaResult.body || lambdaResult
    }

    if (action === 'download' && parsedBody.csv_details?.generated) {
      // Check if presigned URL is available
      if (parsedBody.download?.presigned_url && parsedBody.download?.direct_download) {
        // Return the presigned URL for direct download
        return NextResponse.json({
          success: true,
          download_type: 'presigned_url',
          presigned_url: parsedBody.download.presigned_url,
          expires_in: parsedBody.download.expires_in,
          filename: parsedBody.csv_details.filename,
          metadata: {
            total_records: parsedBody.summary.total_records,
            size_info: parsedBody.csv_details.size_info,
            analysis_columns_added: parsedBody.csv_details.analysis_columns_added,
            generated_at: parsedBody.generated_at
          }
        })
      }

      // Fallback to S3 direct access if no presigned URL
      const s3Location = parsedBody.csv_details.s3_location
      const s3Key = parsedBody.csv_details.filename
      
      if (!s3Key) {
        throw new Error('S3 key not found in Lambda response')
      }

      // Get the CSV file from S3
      const s3Command = new GetObjectCommand({
        Bucket: S3_ADHOC_DOWNLOAD_BUCKET,
        Key: s3Key,
      })

      const s3Response = await s3Client.send(s3Command)
      
      if (!s3Response.Body) {
        throw new Error('No content found in S3 object')
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      const reader = s3Response.Body.transformToWebStream().getReader()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      
      const buffer = Buffer.concat(chunks)
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `adhoc_job_${job_id}_${timestamp}.csv`

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length.toString(),
        },
      })
    }

    // Return job status and CSV info
    return NextResponse.json({
      success: true,
      data: parsedBody
    })

  } catch (error) {
    console.error('Ad-hoc CSV API error:', error)
    return NextResponse.json(
      { error: 'Failed to process CSV request' },
      { status: 500 }
    )
  }
}
