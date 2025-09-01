"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"


import { Loader2, RefreshCw, Download, FileSpreadsheet, Clock, Database } from "lucide-react"
import { useToast } from "../hooks/use-toast"

interface AdHocJob {
  job_id: string
  created_at: string
  status: string
  brand_name: string
  total_tasks: number
  completed_tasks: number
  // Enhanced fields from backend response
  csv_details?: {
    generated: boolean
    s3_location?: string
    filename?: string
  }
  download?: {
    presigned_url?: string
    expires_in?: string
    direct_download: boolean
  }
}

interface AdHocJobsResponse {
  jobs: AdHocJob[]
  total_count: number
}

interface CachedDownload {
  jobId: string
  presignedUrl: string
  filename: string
  expiresAt: number
  metadata: {
    size_info: string
    generated_at: string
  }
}

interface DownloadResponse {
  success: boolean
  download_type?: 'presigned_url'
  presigned_url?: string
  expires_in?: string
  filename?: string
  metadata?: {
    size_info: string
    generated_at: string
  }
}

export default function AdHocJobsPage() {
  const [jobs, setJobs] = useState<AdHocJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingJobs, setDownloadingJobs] = useState<Set<string>>(new Set())
  const [generatingJobs, setGeneratingJobs] = useState<Set<string>>(new Set())
  const [cachedDownloads, setCachedDownloads] = useState<Map<string, CachedDownload>>(new Map())

  const { toast } = useToast()

  // LocalStorage utilities for managing cached downloads
  const CACHE_KEY = 'adhoc_cached_downloads'
  const SAFETY_MARGIN_MS = 60 * 1000 // 60 seconds early expiry for safety

  const saveCachedDownload = (download: CachedDownload) => {
    try {
      const existing = getCachedDownloads()
      existing.set(download.jobId, download)
      localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(existing.entries())))
      setCachedDownloads(new Map(existing))
    } catch (error) {
      console.error('Failed to save cached download:', error)
    }
  }

  const getCachedDownloads = (): Map<string, CachedDownload> => {
    try {
      const stored = localStorage.getItem(CACHE_KEY)
      if (!stored) return new Map()
      
      const entries = JSON.parse(stored) as [string, CachedDownload][]
      const now = Date.now()
      
      // Filter out expired entries
      const validEntries = entries.filter(([_, download]) => 
        download.expiresAt > now + SAFETY_MARGIN_MS
      )
      
      // Update localStorage if we removed expired entries
      if (validEntries.length !== entries.length) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(validEntries))
      }
      
      return new Map(validEntries)
    } catch (error) {
      console.error('Failed to get cached downloads:', error)
      return new Map()
    }
  }

  const getCachedDownload = (jobId: string): CachedDownload | null => {
    const cached = getCachedDownloads()
    const download = cached.get(jobId)
    
    if (!download) return null
    
    // Check if expired (with safety margin)
    if (download.expiresAt <= Date.now() + SAFETY_MARGIN_MS) {
      cached.delete(jobId)
      localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(cached.entries())))
      setCachedDownloads(new Map(cached))
      return null
    }
    
    return download
  }

  const clearCachedDownload = (jobId: string) => {
    const existing = getCachedDownloads()
    existing.delete(jobId)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(existing.entries())))
    setCachedDownloads(new Map(existing))
  }

  const parseExpiresIn = (expiresIn: string): number => {
    // Parse "1 hour" format and return timestamp
    const now = Date.now()
    if (expiresIn.includes('hour')) {
      return now + (60 * 60 * 1000) // 1 hour from now
    }
    // Default to 1 hour if format is unclear
    return now + (60 * 60 * 1000)
  }

  useEffect(() => {
    fetchAdHocJobs()
    // Load cached downloads on component mount
    setCachedDownloads(getCachedDownloads())
  }, [])

  // Periodic cleanup of expired cached downloads
  useEffect(() => {
    const interval = setInterval(() => {
      setCachedDownloads(getCachedDownloads())
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const fetchAdHocJobs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/adhoc-jobs")
      const data: AdHocJobsResponse = await response.json()
      
      if (response.ok) {
        setJobs(data.jobs)
      } else {
        throw new Error("Failed to fetch Ad-hoc jobs")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch Ad-hoc jobs",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadFromPresignedUrl = (cachedDownload: CachedDownload) => {
    const link = document.createElement("a")
    link.href = cachedDownload.presignedUrl
    link.download = cachedDownload.filename
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const generateAndDownloadCSV = async (jobId: string) => {
    // Check if we have a cached download first
    const cached = getCachedDownload(jobId)
    if (cached) {
      // If there's a cached download, clear it and regenerate
      clearCachedDownload(jobId)
      
      toast({
        title: "Regenerating CSV",
        description: "Clearing cache and generating fresh CSV...",
      })
    }

    setGeneratingJobs(prev => new Set(prev).add(jobId))
    
    try {
      // First, generate/check CSV status
      const statusResponse = await fetch("/api/adhoc-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      })

      if (!statusResponse.ok) {
        throw new Error("Failed to generate CSV")
      }

      const statusData = await statusResponse.json()
      
      if (!statusData.success || !statusData.data.csv_details?.generated) {
        throw new Error("CSV generation failed or not ready")
      }

      toast({
        title: "CSV Ready",
        description: "CSV generated successfully. Starting download...",
      })

      // Now download the CSV
      setGeneratingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
      setDownloadingJobs(prev => new Set(prev).add(jobId))

      const downloadResponse = await fetch("/api/adhoc-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, action: "download" }),
      })

      if (!downloadResponse.ok) {
        throw new Error("Failed to download CSV")
      }

      // Check if response is JSON (presigned URL) or blob (direct download)
      const contentType = downloadResponse.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        const downloadData: DownloadResponse = await downloadResponse.json()

        // Handle presigned URL response
        if (downloadData.download_type === 'presigned_url' && downloadData.presigned_url) {
          const cachedDownload: CachedDownload = {
            jobId,
            presignedUrl: downloadData.presigned_url,
            filename: downloadData.filename || `adhoc_job_${jobId}_${new Date().toISOString().split('T')[0]}.csv`,
            expiresAt: parseExpiresIn(downloadData.expires_in || '1 hour'),
                      metadata: downloadData.metadata || {
            size_info: 'Unknown',
            generated_at: new Date().toISOString()
          }
          }

          // Save to cache
          saveCachedDownload(cachedDownload)

          // Download immediately
          downloadFromPresignedUrl(cachedDownload)

          toast({
            title: "Success",
            description: "CSV downloaded successfully!",
          })
        } else {
          throw new Error("Invalid JSON response format")
        }
      } else {
        // Handle blob response (fallback)
        const blob = await downloadResponse.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        
        // Get filename from response headers or create default
        const contentDisposition = downloadResponse.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
        const filename = filenameMatch ? filenameMatch[1] : `adhoc_job_${jobId}_${new Date().toISOString().split('T')[0]}.csv`
        
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Success",
          description: "CSV downloaded successfully!",
        })
      }
    } catch (error) {
      console.error("CSV download error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download CSV",
        variant: "destructive",
      })
    } finally {
      setGeneratingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
      setDownloadingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }



  const getCompletionRate = (completed: number, total: number) => {
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  }

  const formatTimeRemaining = (expiresAt: number): string => {
    const now = Date.now()
    const remaining = expiresAt - now
    
    if (remaining <= 0) return 'Expired'
    
    const minutes = Math.floor(remaining / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  return isLoading ? (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading Ad-hoc jobs...</p>
      </div>
    </div>
  ) : (
    <main className="container mx-auto px-6 md:px-8 py-10 max-w-7xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Ad-hoc Jobs
          </h1>
          <p className="text-muted-foreground text-pretty">
            Manage and download CSV results for Ad-hoc processing jobs
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {jobs.length} total jobs
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchAdHocJobs}
            disabled={isLoading}
            aria-label="Refresh jobs list"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <Card className="border">
          <CardContent className="p-12">
            <div className="text-center">
              <FileSpreadsheet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Ad-hoc Jobs Found</h3>
              <p className="text-muted-foreground">
                Ad-hoc jobs will appear here after processing JSON uploads.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section aria-label="Jobs" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {jobs.map((job) => {
            const completionRate = getCompletionRate(job.completed_tasks, job.total_tasks)
            const isProcessing = generatingJobs.has(job.job_id)
            const isDownloading = downloadingJobs.has(job.job_id)
            const cachedDownload = cachedDownloads.get(job.job_id)
  
            return (
              <Card key={job.job_id} className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-mono truncate" title={job.job_id}>
                        {job.job_id}
                      </CardTitle>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate" title={job.brand_name}>
                          {job.brand_name}
                        </span>
                        <span aria-hidden="true">•</span>
                        <time dateTime={new Date(job.created_at).toISOString()}>
                          {new Date(job.created_at).toLocaleDateString()}
                        </time>
                      </div>
                    </div>
                  </div>
                </CardHeader>
  
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Progress */}
                    <div aria-label="Job progress">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span className="text-muted-foreground">
                          {job.completed_tasks}/{job.total_tasks} tasks
                        </span>
                      </div>
                      <div className="flex items-center gap-2" title={`${completionRate}% complete`}>
                        <div
                          className="flex-1 bg-muted rounded-full h-2"
                          role="progressbar"
                          aria-valuenow={completionRate}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Completion ${completionRate} percent`}
                        >
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground min-w-[35px] text-right">
                          {completionRate}%
                        </span>
                      </div>
                    </div>

                    {/* CSV Details */}
                    {job.csv_details && (
                      <div className="space-y-3 p-3 bg-green-50/50 rounded-lg border border-green-200/50">
                        <h4 className="text-sm font-medium text-green-900">CSV Details</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-green-700 font-medium">Status:</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              job.csv_details.generated 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {job.csv_details.generated ? 'Generated' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Download Information */}
                    {job.download && (
                      <div className="space-y-3 p-3 bg-purple-50/50 rounded-lg border border-purple-200/50">
                        <h4 className="text-sm font-medium text-purple-900">Download</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-purple-700 font-medium">Type:</span>
                            <span className="text-purple-600">
                              {job.download.direct_download ? 'Direct Download' : 'Presigned URL'}
                            </span>
                          </div>
                          {job.download.expires_in && (
                            <div className="flex items-center justify-between">
                              <span className="text-purple-700 font-medium">Expires:</span>
                              <span className="text-purple-600">{job.download.expires_in}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}


  
                    {/* Cache Status */}
                    {cachedDownload && (
                      <div className="space-y-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200/50">
                        <h4 className="text-sm font-medium text-amber-900">Cached Download</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-amber-700 font-medium">Status:</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">
                              Available
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-amber-600">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                Generated {new Date(cachedDownload.metadata.generated_at).toLocaleString()}
                              </span>
                            </div>
                            <span aria-hidden="true">•</span>
                            <span>
                              Expires in {formatTimeRemaining(cachedDownload.expiresAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
  
                    {/* Actions */}
                    <div className="flex gap-2">
                      
  
                      {cachedDownload && (
                        <Button
                          size="sm"
                          onClick={() => downloadFromPresignedUrl(cachedDownload)}
                          disabled={isDownloading}
                          aria-busy={isDownloading}
                          aria-label={`Download CSV for ${job.job_id}`}
                        >
                          {isDownloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => generateAndDownloadCSV(job.job_id)}
                        disabled={isProcessing || isDownloading}
                        aria-busy={isProcessing}
                        aria-label={cachedDownload ? `Regenerate CSV for ${job.job_id}` : `Generate CSV for ${job.job_id}`}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : cachedDownload ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Regenerate CSV
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Generate CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}
  
      {/* Local History */}
      {cachedDownloads.size > 0 && (
        <section aria-label="Local history">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Local History ({cachedDownloads.size} cached reports)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Recently generated reports available for instant download
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(cachedDownloads.entries()).map(([jobId, download]) => (
                  <div key={jobId} className="p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-3">
                      <div>
                        <p className="font-mono text-sm truncate" title={jobId}>
                          {jobId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {download.metadata.size_info}
                        </p>
                      </div>
  
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              Generated {new Date(download.metadata.generated_at).toLocaleString()}
                            </span>
                          </div>
                          <span aria-hidden="true">•</span>
                          <span>Expires in {formatTimeRemaining(download.expiresAt)}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFromPresignedUrl(download)}
                          aria-label={`Download CSV for ${jobId}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  )
}