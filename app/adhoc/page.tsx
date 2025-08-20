"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCw, Download, FileSpreadsheet, Calendar, Activity } from "lucide-react"
import { useToast } from "../hooks/use-toast"

interface AdHocJob {
  job_id: string
  created_at: string
  status: string
  brand_name: string
  total_tasks: number
  completed_tasks: number
}

interface AdHocJobsResponse {
  jobs: AdHocJob[]
  total_count: number
}

export default function AdHocJobsPage() {
  const [jobs, setJobs] = useState<AdHocJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingJobs, setDownloadingJobs] = useState<Set<string>>(new Set())
  const [generatingJobs, setGeneratingJobs] = useState<Set<string>>(new Set())

  const { toast } = useToast()

  useEffect(() => {
    fetchAdHocJobs()
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

  const generateAndDownloadCSV = async (jobId: string) => {
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
        description: `CSV generated with ${statusData.data.summary.total_records} records. Starting download...`,
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

      // Create blob and download
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

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "job_success":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
      case "failed":
      case "job_failed":
        return "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20"
      case "running":
      case "job_running":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20"
      default:
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
    }
  }

  const getCompletionRate = (completed: number, total: number) => {
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading Ad-hoc jobs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 md:px-8 py-10 max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
            Ad-hoc Jobs
          </h1>
          <p className="text-muted-foreground">
            Manage and download CSV results for Ad-hoc processing jobs
          </p>
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>{jobs.length} total jobs</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAdHocJobs} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Jobs Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/15 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-semibold">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/15 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed Jobs</p>
                <p className="text-2xl font-semibold">
                  {jobs.filter(job => job.status?.toLowerCase() === 'completed' || job.status?.toLowerCase() === 'job_success').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/15 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recent Jobs</p>
                <p className="text-2xl font-semibold">
                  {jobs.filter(job => {
                    const jobDate = new Date(job.created_at)
                    const weekAgo = new Date()
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    return jobDate > weekAgo
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card className="bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Ad-hoc Processing Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Ad-hoc Jobs Found</h3>
              <p className="text-muted-foreground">
                Ad-hoc jobs will appear here after processing JSON uploads
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Job ID</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px]">Tasks</TableHead>
                    <TableHead className="w-[100px]">Progress</TableHead>
                    <TableHead className="w-[140px]">Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const completionRate = getCompletionRate(job.completed_tasks, job.total_tasks)
                    const isProcessing = generatingJobs.has(job.job_id)
                    const isDownloading = downloadingJobs.has(job.job_id)
                    
                    return (
                      <TableRow key={job.job_id}>
                        <TableCell className="font-mono text-sm">
                          <div className="max-w-[280px]">
                            <p className="truncate" title={job.job_id}>
                              {job.job_id}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(job.status)}>
                            {job.status || 'unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{job.completed_tasks}/{job.total_tasks}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground min-w-[35px]">
                              {completionRate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {new Date(job.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => generateAndDownloadCSV(job.job_id)}
                            disabled={isProcessing || isDownloading}
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Generating
                              </>
                            ) : isDownloading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Downloading
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-1" />
                                CSV
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
