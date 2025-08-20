"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Search, Loader2, RefreshCw, Eye, ChevronLeft, ChevronRight, Filter, Download, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react"
import { useToast } from "../hooks/use-toast"
import { TaskResponseContent } from "@/components/ui/task-response-content"
import type { RDSResultsResponse, RDSTaskResult, ScrapeJob } from "../lib/types"

interface TableRow {
  id: string
  jobId: string
  brand: string
  productName: string
  query: string
  status: string
  llmModel: string
  createdAt: string
  completedAt: string | null
  task: RDSTaskResult
}

export default function ResultsPage() {
  const [results, setResults] = useState<RDSResultsResponse>({ tasks: [], total_count: 0 })
  const [tableData, setTableData] = useState<TableRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [modelFilter, setModelFilter] = useState<string>("all")
  const [jobIdFilter, setJobIdFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<RDSTaskResult | null>(null)
  
  // Job download state
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [jobsWithS3Data, setJobsWithS3Data] = useState<Set<string>>(new Set())
  const [downloadingJobs, setDownloadingJobs] = useState<Set<string>>(new Set())
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<string>("")
  const [selectedJobId, setSelectedJobId] = useState<string>("")
  
  const ROWS_PER_PAGE = 30

  const { toast } = useToast()

  useEffect(() => {
    fetchResults()
    fetchJobs()
  }, [])

  useEffect(() => {
    // Transform tasks data into table rows
    const rows: TableRow[] = results.tasks.map((task) => ({
      id: task.task_id,
      jobId: task.job_id || "Unknown Job",
      brand: task.brand_name || "Unknown Brand",
      productName: task.product_name || task.product_id?.toString() || "Unknown Product",
      query: task.query_text || "No query text",
      status: task.status || "unknown",
      llmModel: task.llm_model_name || "Unknown Model",
      createdAt: task.created_at,
      completedAt: task.completed_at,
      task: task
    }))
    
    setTableData(rows)
  }, [results])

  const fetchResults = async () => {
    try {
      const response = await fetch("/api/results-rds")
      const data = await response.json()
      setResults(data)
      setIsLoading(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch results",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      setJobsLoading(true)
      const response = await fetch("/api/jobs")
      const data = await response.json()

      if (Array.isArray(data)) {
        setJobs(data)
        // Check S3 data for all jobs
        checkJobsS3Data(data)
      } else {
        console.error("Jobs API returned non-array:", data)
        setJobs([])
        toast({
          title: "Warning",
          description: "Failed to load jobs for download",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching jobs:", error)
      setJobs([])
      toast({
        title: "Error",
        description: "Failed to fetch jobs for download",
        variant: "destructive",
      })
    } finally {
      setJobsLoading(false)
    }
  }

  // Check which jobs have S3 data available
  const checkJobsS3Data = async (jobsList: ScrapeJob[]) => {
    const newJobsWithS3Data = new Set<string>()
    
    // Check each job in parallel
    const promises = jobsList.map(async (job) => {
      try {
        const response = await fetch(`/api/check-job-s3/${job.job_id}`)
        const data = await response.json()
        
        if (data.hasS3Data) {
          newJobsWithS3Data.add(job.job_id)
        }
      } catch (error) {
        console.error(`Failed to check S3 data for job ${job.job_id}:`, error)
      }
    })
    
    await Promise.all(promises)
    setJobsWithS3Data(newJobsWithS3Data)
  }

  // Handle job download
  const downloadJobData = async (jobId: string) => {
    try {
      setDownloadingJobs(prev => new Set([...Array.from(prev), jobId]))
      
      const response = await fetch(`/api/download-job/${jobId}`)
      
      if (response.ok) {
        // Create blob from response
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        
        // Create temporary download link
        const a = document.createElement('a')
        a.href = url
        a.download = `${jobId}_data.zip`
        document.body.appendChild(a)
        a.click()
        
        // Cleanup
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast({
          title: "Success",
          description: "Job data downloaded successfully",
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to download job data")
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download job data",
        variant: "destructive",
      })
    } finally {
      setDownloadingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  // Helper functions for job dropdowns
  const getUniqueBrands = () => {
    return Array.from(new Set(jobs.map(job => job.brand_name || "Unknown Brand"))).sort()
  }

  const getFilteredJobs = () => {
    if (!selectedBrand) return []
    return jobs.filter(job => (job.brand_name || "Unknown Brand") === selectedBrand)
  }

  const getJobsWithS3DataForBrand = () => {
    return getFilteredJobs().filter(job => jobsWithS3Data.has(job.job_id))
  }

  const handleDownloadSelected = () => {
    if (selectedJobId) {
      downloadJobData(selectedJobId)
    }
  }

  const filteredData = tableData.filter((row) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = (
      row.brand.toLowerCase().includes(searchLower) ||
      row.productName.toLowerCase().includes(searchLower) ||
      row.query.toLowerCase().includes(searchLower) ||
      row.llmModel.toLowerCase().includes(searchLower) ||
      row.jobId.toLowerCase().includes(searchLower)
    )
    
    const matchesBrand = brandFilter === "all" || row.brand === brandFilter
    const matchesStatus = statusFilter === "all" || row.status === statusFilter
    const matchesModel = modelFilter === "all" || row.llmModel === modelFilter
    const matchesJobId = jobIdFilter === "all" || row.jobId === jobIdFilter
    
    return matchesSearch && matchesBrand && matchesStatus && matchesModel && matchesJobId
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE)
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE
  const endIndex = startIndex + ROWS_PER_PAGE
  const paginatedData = filteredData.slice(startIndex, endIndex)

  // Get unique values for filters
  const uniqueBrands = Array.from(new Set(tableData.map(row => row.brand))).sort()
  const uniqueStatuses = Array.from(new Set(tableData.map(row => row.status))).sort()
  const uniqueModels = Array.from(new Set(tableData.map(row => row.llmModel))).sort()
  const uniqueJobIds = Array.from(new Set(tableData.map(row => row.jobId))).sort()

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, brandFilter, statusFilter, modelFilter, jobIdFilter])

  // Reset job selection when brand changes
  useEffect(() => {
    setSelectedJobId("")
  }, [selectedBrand])

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
      case "failed":
        return "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20"
      case "processing":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20"
      default:
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
    }
  }

  const getModelBadgeColor = (model: string) => {
    const modelLower = model.toLowerCase()
    if (modelLower.includes("chatgpt")) {
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/20"
    } else if (modelLower.includes("perplexity")) {
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20"
    } else if (modelLower.includes("aimode") || modelLower.includes("ai_mode")) {
      return "bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/20"
    } else if (modelLower.includes("aioverview") || modelLower.includes("aio")) {
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20"
    }
    return "bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/20"
  }

  // Helper functions for job status icons and colors
  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case "JOB_SUCCESS":
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "JOB_FAILED":
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "JOB_RUNNING":
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case "JOB_SUCCESS":
      case "completed":
        return "bg-green-100 text-green-800"
      case "JOB_FAILED":
      case "failed":
        return "bg-red-100 text-red-800"
      case "JOB_RUNNING":
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "llm_generated":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const downloadTaskResult = async (task: RDSTaskResult) => {
    try {
      if (!task.s3_output_path) {
        toast({
          title: "Error",
          description: "No S3 output path available for this task",
          variant: "destructive",
        })
        return
      }

      // Fetch content directly from S3
      const response = await fetch(`/api/task-content/${task.task_id}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch task content")
      }

      if (!data.s3_content) {
        throw new Error("No S3 content available")
      }

      // Create filename-safe strings
      const safeBrand = (task.brand_name || "Unknown").replace(/[^a-z0-9]/gi, '_')
      const safeProduct = (task.product_name || "Unknown").replace(/[^a-z0-9]/gi, '_')
      const safeModel = (task.llm_model_name || "Unknown").replace(/[^a-z0-9]/gi, '_')
      const timestamp = new Date(task.created_at).toISOString().split('T')[0]
      
      // Determine file extension based on S3 path
      const fileExtension = task.s3_output_path.endsWith('.json') ? 'json' : 
                           task.s3_output_path.endsWith('.md') ? 'md' : 'txt'
      
      // Create file content
      let content: string
      if (typeof data.s3_content === 'string') {
        content = data.s3_content
      } else {
        content = JSON.stringify(data.s3_content, null, 2)
      }
      
      // Create and download the file
      const blob = new Blob([content], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${safeBrand}_${safeProduct}_${safeModel}_${timestamp}.${fileExtension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Success",
        description: "S3 content downloaded successfully!",
      })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Error",
        description: "Failed to download S3 content",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 md:px-8 py-10 max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
            AI Task Results
          </h1>
          <p className="text-muted-foreground">
            View and manage AI processing tasks from the database
          </p>
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>{results.total_count} total tasks</span>
            <span>{filteredData.length} filtered results</span>
            {totalPages > 1 && (
              <span>Page {currentPage} of {totalPages}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchResults}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Job Downloads */}
      <Card className="mb-6 bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Job Data Downloads</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchJobs} disabled={jobsLoading}>
                {jobsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No jobs found</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Brand Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Brand</label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a brand</option>
                    {getUniqueBrands().map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Job ID Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Job ID</label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    disabled={!selectedBrand}
                    className="w-full px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a job</option>
                    {getJobsWithS3DataForBrand().map((job) => (
                      <option key={job.job_id} value={job.job_id}>
                        {job.job_id} ({new Date(job.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Download Button */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Action</label>
                  <Button
                    onClick={handleDownloadSelected}
                    disabled={!selectedJobId || downloadingJobs.has(selectedJobId)}
                    className="w-full h-10"
                  >
                    {downloadingJobs.has(selectedJobId) ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download ZIP
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Info Messages */}
              <div className="space-y-2">
                {selectedBrand && getFilteredJobs().length === 0 && (
                  <div className="text-center py-2 px-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      No jobs found for "{selectedBrand}"
                    </p>
                  </div>
                )}
                
                {selectedBrand && getFilteredJobs().length > 0 && getJobsWithS3DataForBrand().length === 0 && (
                  <div className="text-center py-2 px-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      No downloadable S3 data available for "{selectedBrand}" jobs
                    </p>
                  </div>
                )}

                {jobsWithS3Data.size === 0 && (
                  <div className="text-center py-2 px-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      No jobs currently have downloadable S3 data available
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className="mb-6 bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search by brand, product, query, or AI model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10"
                />
              </div>
            </div>
            
            <div className="flex gap-4 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-4 flex-wrap">
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm"
                >
                  <option value="all">All Brands</option>
                  {uniqueBrands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm"
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>

                <select
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm"
                >
                  <option value="all">All AI Models</option>
                  {uniqueModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>

                <select
                  value={jobIdFilter}
                  onChange={(e) => setJobIdFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm"
                >
                  <option value="all">All Job IDs</option>
                  {uniqueJobIds.map((jobId) => (
                    <option key={jobId} value={jobId}>{jobId}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">AI Processing Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Results Found</h3>
              <p className="text-muted-foreground">
                {tableData.length === 0 
                  ? "No AI processing tasks available"
                  : "No tasks match your search criteria"
                }
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Brand</TableHead>
                      <TableHead className="w-[200px]">Product Name</TableHead>
                      <TableHead className="w-[300px]">Query</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px]">AI Model</TableHead>
                      <TableHead className="w-[120px]">Created</TableHead>
                      <TableHead className="w-[100px]">Details</TableHead>
                      <TableHead className="w-[100px]">Download</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          <div className="max-w-[120px]">
                            <p className="truncate" title={row.brand}>
                              {row.brand}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="truncate" title={row.productName}>
                              {row.productName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="truncate" title={row.query}>
                              {row.query}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(row.status)}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getModelBadgeColor(row.llmModel)}>
                            {row.llmModel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {new Date(row.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedTask(row.task)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                        <TableCell>
                          {row.task.s3_output_path ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadTaskResult(row.task)}
                              title="Download task result"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">No data</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Task Details Sheet */}
      <Sheet open={selectedTask !== null} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent 
          className="overflow-y-auto" 
          side="right"
          resizable
          defaultWidth={900}
          minWidth={500}
          maxWidth={1000}
        >
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">
                  {selectedTask.brand_name} - {selectedTask.product_name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <TaskResponseContent
                  task={selectedTask}
                  onDownload={downloadTaskResult}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}