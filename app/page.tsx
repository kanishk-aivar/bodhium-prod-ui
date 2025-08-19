"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, ArrowRight } from "lucide-react"
import { useToast } from "./hooks/use-toast"
import type { ScrapeJob } from "./lib/types"

export default function HomePage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [brandUrl, setBrandUrl] = useState("")
  const [brandName, setBrandName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWorkflowsExpanded, setIsWorkflowsExpanded] = useState(true)

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
          <p className="text-muted-foreground text-base">Start your brand analysis by submitting a URL</p>
        </div>

        {/* URL Submission */}
        <Card className="mb-8 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-white/60 shadow-lg dark:bg-white/5 dark:border-white/10">
          <CardHeader>
            <CardTitle>Submit Brand URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
            </div>
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card className="bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-white/60 shadow-lg dark:bg-white/5 dark:border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Workflows</CardTitle>
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
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {Array.isArray(jobs) && jobs.length > 0 ? (
                  jobs.map((job) => (
                    <div
                      key={job.job_id}
                      className="flex items-center justify-between p-4 bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-xl border border-white/60 dark:border-white/10 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(job.status ?? "")}
                        <div>
                          <p className="font-medium text-sm">{job.brand_name || "Unknown Brand"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(job.status ?? "")}>{job.status}</Badge>
                        {job.status === "JOB_SUCCESS" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push("/products")}
                          >
                            Products <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                        {job.status === "llm_generated" && (
                          <Button size="sm" variant="outline" onClick={() => router.push("/results")}>
                            Results <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">No workflows found</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  )
}
