"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, ArrowRight, Upload, FileText } from "lucide-react"
import { useToast } from "./hooks/use-toast"
import type { ScrapeJob } from "./lib/types"

export default function HomePage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [brandUrl, setBrandUrl] = useState("")
  const [brandName, setBrandName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWorkflowsExpanded, setIsWorkflowsExpanded] = useState(true)
  
  // Ad hoc mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs")
      const data = await response.json()

      if (Array.isArray(data)) {
        setJobs(data)
      } else {
        console.error("Jobs API returned non-array:", data)
        setJobs([])
        toast({
          title: "Warning",
          description: "Failed to load job history",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching jobs:", error)
      setJobs([])
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      })
    }
  }

  const submitBrandUrl = async () => {
    if (!brandUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid brand URL",
        variant: "destructive",
      })
      return
    }

    // Validate brand name - cannot be "Ad-hoc"
    if (brandName.trim().toLowerCase() === 'ad-hoc') {
      toast({
        title: "Invalid Brand Name",
        description: "Brand name cannot be 'Ad-hoc'. This name is reserved for Ad Hoc mode.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const requestBody: { url: string; brand_name?: string } = { url: brandUrl }
      if (brandName.trim()) {
        requestBody.brand_name = brandName.trim()
      }

      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: `Job submitted successfully!`,
        })

        const newJob: ScrapeJob = {
          job_id: data.job_id,
          source_url: brandUrl,
          status: "SUBMITTED",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          brand_name: brandName.trim() || new URL(brandUrl).hostname,
          progress: {
            urls_collected: 0,
            urls_visited: 0,
            products_scraped: 0
          }
        }

        setJobs((prev) => [newJob, ...prev])
        setBrandUrl("")
        setBrandName("")

        // Poll job status and navigate to products when complete
        pollJobStatus(data.job_id)
      } else {
        throw new Error(data.error || "Failed to submit job")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit job",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        const job = await response.json()

        setJobs((prev) => prev.map((j) => (j.job_id === jobId ? job : j)))

        if (job.status === "JOB_SUCCESS") {
          clearInterval(pollInterval)
          toast({
            title: "Success",
            description: "Scraping completed! Redirecting to products page...",
          })
          setTimeout(() => router.push("/products"), 1500)
        } else if (job.status === "JOB_FAILED") {
          clearInterval(pollInterval)
          toast({
            title: "Job Failed",
            description: "The scraping job failed. Please try again.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error polling job status:", error)
      }
    }, 5000)

    setTimeout(() => clearInterval(pollInterval), 600000)
  }

  // JSON Schema validation
  const validateJsonSchema = (jsonData: any): { valid: boolean; error?: string } => {
    try {
      // Check if it's an object
      if (typeof jsonData !== 'object' || jsonData === null) {
        return { valid: false, error: "JSON must be an object" }
      }

      // Check required fields
      if (!jsonData.queries) {
        return { valid: false, error: "Missing required field: 'queries'" }
      }

      // Validate queries array
      if (!Array.isArray(jsonData.queries)) {
        return { valid: false, error: "'queries' must be an array" }
      }

      if (jsonData.queries.length === 0) {
        return { valid: false, error: "'queries' array cannot be empty" }
      }

      // Check each query is a string
      for (let i = 0; i < jsonData.queries.length; i++) {
        if (typeof jsonData.queries[i] !== 'string') {
          return { valid: false, error: `Query at index ${i} must be a string` }
        }
        if (jsonData.queries[i].trim() === '') {
          return { valid: false, error: `Query at index ${i} cannot be empty` }
        }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: "Invalid JSON structure" }
    }
  }

  // Ad hoc mode functions
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.json')) {
        toast({
          title: "Invalid File",
          description: "Please select a JSON file",
          variant: "destructive",
        })
        return
      }

      // Validate JSON content
      try {
        const text = await file.text()
        const jsonData = JSON.parse(text)
        const validation = validateJsonSchema(jsonData)
        
        if (!validation.valid) {
          toast({
            title: "Invalid JSON Schema",
            description: validation.error,
            variant: "destructive",
          })
          return
        }

        setSelectedFile(file)
      } catch (error) {
        toast({
          title: "Invalid JSON",
          description: "Please select a valid JSON file",
          variant: "destructive",
        })
      }
    }
  }

  const handleFileDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.json')) {
        toast({
          title: "Invalid File",
          description: "Please select a JSON file",
          variant: "destructive",
        })
        return
      }

      // Validate JSON content
      try {
        const text = await file.text()
        const jsonData = JSON.parse(text)
        const validation = validateJsonSchema(jsonData)
        
        if (!validation.valid) {
          toast({
            title: "Invalid JSON Schema",
            description: validation.error,
            variant: "destructive",
          })
          return
        }

        setSelectedFile(file)
      } catch (error) {
        toast({
          title: "Invalid JSON",
          description: "Please select a valid JSON file",
          variant: "destructive",
        })
      }
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const removeFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadAdHocFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a JSON file",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/adhoc-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "File uploaded successfully! Processing started. Redirecting to results...",
        })
        
        // Reset form
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        
        // Redirect to results page
        setTimeout(() => router.push("/results"), 1500)
      } else {
        throw new Error(data.error || "Failed to upload file")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusIcon = (status: string) => {
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

  const getStatusColor = (status: string) => {
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



  return (
    <div className="container mx-auto px-6 md:px-8 py-12 max-w-5xl">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
            Bodhium Measurement Tool
          </h1>
          <p className="text-muted-foreground text-base">Start your brand analysis by submitting a URL or upload queries directly in Ad Hoc mode</p>
        </div>

        {/* Mode Selection Tabs */}
        <Card className="mb-8 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-white/60 shadow-lg dark:bg-white/5 dark:border-white/10">
          <CardContent className="p-6">
            <Tabs defaultValue="brand-url" className="w-full">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="brand-url" className="flex-1">Submit Brand URL</TabsTrigger>
                <TabsTrigger value="adhoc" className="flex-1">Ad Hoc Mode</TabsTrigger>
              </TabsList>
              
              {/* Brand URL Tab */}
              <TabsContent value="brand-url" className="space-y-4">
                <div className="space-y-3">
                  <Input
                    placeholder="Enter brand URL (e.g., https://store.example.com)"
                    value={brandUrl}
                    onChange={(e) => setBrandUrl(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/50 focus-visible:border-[hsl(var(--accent))]/50"
                  />
                  <div className="relative">
                    <Input
                      placeholder="Brand name (optional)"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      disabled={isSubmitting}
                      className="h-12 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/50 focus-visible:border-[hsl(var(--accent))]/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5 pl-1">
                      Leave empty to auto-detect from URL hostname
                    </p>
                  </div>
                  <Button
                    onClick={submitBrandUrl} 
                    disabled={isSubmitting}
                    className="px-6 h-11 min-w-[120px] rounded-xl shadow-md"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Submit"}
                  </Button>
                </div>
              </TabsContent>
              
              {/* Ad Hoc Mode Tab */}
              <TabsContent value="adhoc" className="space-y-4">
                <div className="space-y-4">
                  {/* File Upload Area */}
                  <div
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
                    onDrop={handleFileDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? (
                      <div className="space-y-3">
                        <FileText className="h-12 w-12 mx-auto text-green-500" />
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-400">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile()
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-12 w-12 mx-auto text-gray-400" />
                        <div>
                          <p className="text-lg font-medium">Upload JSON File</p>
                          <p className="text-sm text-muted-foreground">
                            Drag and drop your JSON file here, or click to browse
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <div className="text-xs text-muted-foreground space-y-1 pl-1">
                    <p>• Only JSON files are accepted</p>
                    <p>• File must match the required schema format</p>
                    <p>• File will be uploaded to S3 and processed automatically</p>
                    <p>• Processing results will appear on the Results page</p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                        Show JSON Schema Example
                      </summary>
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                        <pre className="text-xs overflow-x-auto">
{`{
  "queries": [
    "What are the best laptops under $1000 in USA?",
    "What are the best hair bands for women in USA?",
    "What are the best hair ties for women in USA?"
  ]
}`}
                        </pre>
                        <div className="mt-2 text-xs space-y-1">
                          <p><strong>Required fields:</strong></p>
                          <p>• queries: Array of non-empty strings</p>
                        </div>
                      </div>
                    </details>
                  </div>
                  
                  <Button
                    onClick={uploadAdHocFile}
                    disabled={!selectedFile || isUploading}
                    className="px-6 h-11 min-w-[140px] rounded-xl shadow-md"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload & Process
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card className="bg-transparent backdrop-blur supports-[backdrop-filter]:bg-transparent border border-white/60 shadow-lg dark:bg-transparent dark:border-white/10">
        <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Recent Workflows</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={fetchJobs}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsWorkflowsExpanded(!isWorkflowsExpanded)}>
                  {isWorkflowsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isWorkflowsExpanded && (
              <div className="space-y-6 max-h-[32rem] overflow-y-auto pr-1">
                {Array.isArray(jobs) && jobs.length > 0 ? (
                  jobs.map((job) => (
                    <div
                      key={job.job_id}
                      className="p-6 bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-xl border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                            {getStatusIcon(job.status ?? "")}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {job.brand_name || "Unknown Brand"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Started {new Date(job.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge className={`px-3 py-1.5 text-sm font-medium ${getStatusColor(job.status ?? "")}`}>
                            {job.status}
                          </Badge>
                          {job.status === "JOB_SUCCESS" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push("/products")}
                              className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              View Products <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          )}
                          {job.status === "llm_generated" && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => router.push("/results")}
                              className="hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                              View Results <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Progress Section */}
                      {job.progress && (job.status === "JOB_RUNNING" || job.status === "SUBMITTED") && (
                        <div className="space-y-5">
                          {/* Products Found - Large Display */}
                          <div className="text-center py-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                              {job.progress.products_scraped}
                            </div>
                            <div className="text-sm font-medium text-green-700 dark:text-green-300">
                              Products Found
                            </div>
                          </div>

                          {/* URL Progress Bar */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                URL Processing Progress
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {job.progress.urls_visited} / {job.progress.urls_collected}
                              </span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-full transition-all duration-1000 ease-out shadow-sm"
                                style={{ 
                                  width: `${Math.min((job.progress.urls_visited / Math.max(job.progress.urls_collected, 1)) * 100, 100)}%` 
                                }}
                              />
                              {/* Animated shimmer effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                            </div>
                          </div>

                          {/* Live Stats Grid */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                {job.progress.urls_collected}
                              </div>
                              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                URLs Found
                              </div>
                            </div>
                            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                {job.progress.urls_visited}
                              </div>
                              <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">
                                URLs Visited
                              </div>
                            </div>
                            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                {job.progress.products_scraped}
                              </div>
                              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                                Products
                              </div>
                            </div>
                          </div>

                          {/* Live Indicator */}
                          <div className="flex items-center justify-center gap-2 py-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-sm font-medium">Live Processing</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Completed Job Summary */}
                      {job.progress && (job.status === "JOB_SUCCESS" || job.status === "llm_generated") && (
                        <div className="text-center py-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                            {job.progress.products_scraped}
                          </div>
                          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            Products Successfully Scraped
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-muted-foreground text-lg">No workflows found</p>
                    <p className="text-sm text-muted-foreground mt-1">Start by submitting a brand URL above</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  )
}
