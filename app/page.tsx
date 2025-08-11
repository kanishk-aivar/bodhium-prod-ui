"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, Clock, ArrowRight, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "./hooks/use-toast"
import WorkflowNavigation from "./components/WorkflowNavigation"
import ProductSelector from "./components/ProductSelector"
import QuerySelector from "./components/QuerySelector"
import type { ScrapeJob, Product, Query } from "./lib/types"

export default function WorkflowPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [currentJob, setCurrentJob] = useState<ScrapeJob | null>(null)
  const [brandUrl, setBrandUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [queries, setQueries] = useState<Query[]>([])
  const [selectedQueries, setSelectedQueries] = useState<number[]>([])
  const [customQuery, setCustomQuery] = useState("")
  const [isWorkflowsExpanded, setIsWorkflowsExpanded] = useState(true)
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false)
  const [queriesExist, setQueriesExist] = useState(false)

  const { toast } = useToast()
  const stepRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  useEffect(() => {
    fetchJobs()
  }, [])

  const scrollToStep = (step: number) => {
    const element = stepRefs.current[step]
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

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
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brandUrl }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: `Job submitted successfully! Job ID: ${data.job_id}`,
        })

        const newJob: ScrapeJob = {
          job_id: data.job_id,
          source_url: brandUrl,
          status: "SUBMITTED",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          brand_name: new URL(brandUrl).hostname,
        }

        setCurrentJob(newJob)
        setJobs((prev) => [newJob, ...prev])
        setCurrentStep(2)
        setBrandUrl("")

        setTimeout(() => scrollToStep(2), 100)
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

        setCurrentJob(job)
        setJobs((prev) => prev.map((j) => (j.job_id === jobId ? job : j)))

        if (job.status === "JOB_SUCCESS") {
          clearInterval(pollInterval)
          fetchProducts(jobId)
          setCurrentStep(3)
          setTimeout(() => scrollToStep(3), 100)
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

  const fetchProducts = async (jobId: string) => {
    try {
      const response = await fetch(`/api/products/${jobId}`)
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      })
    }
  }

  const submitProductSelection = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive",
      })
      return
    }

    setCurrentStep(4)
    setTimeout(() => scrollToStep(4), 100)

    // Check if queries already exist
    await checkExistingQueries(currentJob?.job_id!)
  }

  const checkExistingQueries = async (jobId: string) => {
    try {
      const response = await fetch(`/api/queries/${jobId}`)
      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        setQueries(data)
        setQueriesExist(true)
      } else {
        setQueries([])
        setQueriesExist(false)
      }
    } catch (error) {
      console.error("Error checking queries:", error)
      setQueries([])
      setQueriesExist(false)
    }
  }

  const generateQueries = async () => {
    setIsGeneratingQueries(true)
    try {
      const response = await fetch("/api/generate-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: currentJob?.job_id,
          product_ids: selectedProducts,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Query generation started!",
        })

        // Poll for generated queries
        setTimeout(() => {
          checkExistingQueries(currentJob?.job_id!)
        }, 3000)
      } else {
        throw new Error("Failed to generate queries")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate queries",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingQueries(false)
    }
  }

  const addCustomQuery = () => {
    if (!customQuery.trim()) return

    const newQuery: Query = {
      query_id: Date.now(),
      product_id: null,
      query_text: customQuery,
      query_type: "custom",
      is_active: true,
    }

    setQueries((prev) => [...prev, newQuery])
    setSelectedQueries((prev) => [...prev, newQuery.query_id])
    setCustomQuery("")
  }

  const processQueries = async () => {
    if (selectedQueries.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one query",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/process-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: currentJob?.job_id,
          query_ids: selectedQueries,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Query processing started! Check results page for updates.",
        })
        setCurrentStep(5)
        setTimeout(() => scrollToStep(5), 100)
      } else {
        throw new Error("Failed to process queries")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process queries",
        variant: "destructive",
      })
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

  // Group queries by type
  const groupedQueries = queries.reduce(
    (acc, query) => {
      const type = query.query_type || "other"
      if (!acc[type]) acc[type] = []
      acc[type].push(query)
      return acc
    },
    {} as Record<string, Query[]>,
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bodhium Workflow</h1>
          <p className="text-gray-600">Automate brand analysis with AI-powered insights</p>
        </div>

        {/* Step 1: Job Overview & URL Submission */}
        <Card className="mb-6" ref={(el) => (stepRefs.current[1] = el)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                1
              </span>
              Submit Brand URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter brand URL (e.g., https://store.example.com)"
                  value={brandUrl}
                  onChange={(e) => setBrandUrl(e.target.value)}
                  disabled={currentStep > 1}
                />
                <Button onClick={submitBrandUrl} disabled={isSubmitting || currentStep > 1}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </Button>
              </div>

              {/* Recent Jobs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Recent Workflows</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={fetchJobs}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsWorkflowsExpanded(!isWorkflowsExpanded)}>
                      {isWorkflowsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {isWorkflowsExpanded && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Array.isArray(jobs) && jobs.length > 0 ? (
                      jobs.map((job) => (
                        <div
                          key={job.job_id}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(job.status)}
                            <div>
                              <p className="font-medium text-sm">{job.brand_name || "Unknown Brand"}</p>
                              <p className="text-xs text-gray-500">{new Date(job.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                            {job.status === "JOB_SUCCESS" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCurrentJob(job)
                                  fetchProducts(job.job_id)
                                  setCurrentStep(3)
                                  setTimeout(() => scrollToStep(3), 100)
                                }}
                              >
                                Continue
                              </Button>
                            )}
                            {job.status === "llm_generated" && (
                              <Button size="sm" variant="outline" onClick={() => window.open("/results", "_blank")}>
                                Results
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No workflows found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Job Status */}
        {currentStep >= 2 && currentJob && (
          <Card className="mb-6" ref={(el) => (stepRefs.current[2] = el)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  2
                </span>
                Scraping Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {getStatusIcon(currentJob.status)}
                <div>
                  <p className="font-medium">{currentJob.brand_name}</p>
                  <p className="text-sm text-gray-600">Status: {currentJob.status}</p>
                </div>
              </div>
              {currentJob.status === "JOB_RUNNING" && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-800">Scraping in progress... This may take several minutes.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Product Selection */}
        {currentStep >= 3 && products.length > 0 && (
          <Card className="mb-6" ref={(el) => (stepRefs.current[3] = el)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  3
                </span>
                Select Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProductSelector
                products={products}
                selectedProducts={selectedProducts}
                onSelectionChange={setSelectedProducts}
                disabled={currentStep > 3}
              />
              {currentStep === 3 && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={submitProductSelection} disabled={selectedProducts.length === 0}>
                    Continue to Queries <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Query Selection */}
        {currentStep >= 4 && (
          <Card className="mb-6" ref={(el) => (stepRefs.current[4] = el)}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    4
                  </span>
                  Select & Add Queries
                </div>
                {queriesExist && (
                  <Button size="sm" variant="outline" onClick={() => checkExistingQueries(currentJob?.job_id!)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!queriesExist ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No queries found for this job. Generate queries to continue.</p>
                  <Button onClick={generateQueries} disabled={isGeneratingQueries}>
                    {isGeneratingQueries ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Generate Queries
                  </Button>
                </div>
              ) : (
                <>
                  {/* Group queries by type */}
                  {Object.entries(groupedQueries).map(([type, typeQueries]) => (
                    <div key={type} className="mb-6">
                      <h3 className="text-lg font-medium mb-3 capitalize">
                        {type === "product"
                          ? "Product-Based Queries"
                          : type === "market"
                            ? "Market-Based Queries"
                            : `${type} Queries`}
                      </h3>
                      <QuerySelector
                        queries={typeQueries}
                        selectedQueries={selectedQueries}
                        onSelectionChange={setSelectedQueries}
                        disabled={currentStep > 4}
                      />
                    </div>
                  ))}

                  {currentStep === 4 && (
                    <div className="mt-6 space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add custom query..."
                          value={customQuery}
                          onChange={(e) => setCustomQuery(e.target.value)}
                        />
                        <Button onClick={addCustomQuery} variant="outline">
                          Add Query
                        </Button>
                      </div>

                      <div className="flex justify-between">
                        <Button onClick={generateQueries} variant="outline" disabled={isGeneratingQueries}>
                          {isGeneratingQueries ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Regenerate Queries
                        </Button>
                        <Button onClick={processQueries} disabled={selectedQueries.length === 0}>
                          Process Queries <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Processing Complete */}
        {currentStep >= 5 && (
          <Card className="mb-6" ref={(el) => (stepRefs.current[5] = el)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  5
                </span>
                Processing Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Queries are being processed!</h3>
                <p className="text-gray-600 mb-4">
                  Your queries are being processed by our AI models. This may take several minutes to hours depending on
                  the workload.
                </p>
                <Button onClick={() => window.open("/results", "_blank")}>
                  View Results <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <WorkflowNavigation currentStep={currentStep} />
    </div>
  )
}
