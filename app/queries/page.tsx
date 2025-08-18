"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowRight, RefreshCw } from "lucide-react"
import { useToast } from "../hooks/use-toast"
import ProductSelector from "../components/ProductSelector"
import QuerySelector from "../components/QuerySelector"
import type { ScrapeJob, Product, Query } from "../lib/types"

export default function QueriesPage() {
  const [brands, setBrands] = useState<string[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string>("")
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [filteredJobs, setFilteredJobs] = useState<ScrapeJob[]>([])
  const [selectedJob, setSelectedJob] = useState<ScrapeJob | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [queries, setQueries] = useState<Query[]>([])
  const [selectedQueries, setSelectedQueries] = useState<number[]>([])
  const [customQuery, setCustomQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false)
  const [queriesExist, setQueriesExist] = useState(false)

  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/jobs")
      const data = await response.json()

      if (Array.isArray(data)) {
        const successfulJobs = data.filter((job: ScrapeJob) => job.status === "JOB_SUCCESS")
        setJobs(successfulJobs)
        
        // Extract unique brands
        const uniqueBrands = Array.from(new Set(
          successfulJobs
            .map(job => job.brand_name)
            .filter((brand): brand is string => Boolean(brand))
        )).sort()
        setBrands(uniqueBrands)
        
        // Try to load from localStorage first
        const storedBrand = localStorage.getItem('selectedBrand')
        const storedJobId = localStorage.getItem('selectedJobId')
        const storedProductIds = localStorage.getItem('selectedProducts')
        
        if (storedBrand && uniqueBrands.includes(storedBrand)) {
          setSelectedBrand(storedBrand)
          const brandJobs = successfulJobs.filter(job => job.brand_name === storedBrand)
          setFilteredJobs(brandJobs)
          
          if (storedJobId && storedProductIds) {
            const storedJob = brandJobs.find(job => job.job_id === storedJobId)
            if (storedJob) {
              setSelectedJob(storedJob)
              await fetchProducts(storedJobId)
              const parsedProductIds = JSON.parse(storedProductIds)
              setSelectedProducts(parsedProductIds)
              await checkExistingQueries(storedJobId, parsedProductIds)
            }
          }
        }
      } else {
        console.error("Jobs API returned non-array:", data)
        setJobs([])
        setBrands([])
        toast({
          title: "Warning",
          description: "Failed to load jobs",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching jobs:", error)
      setJobs([])
      setBrands([])
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProducts = async (jobId: string) => {
    try {
      setIsLoadingProducts(true)
      const response = await fetch(`/api/products/${jobId}`)
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products",
        variant: "destructive",
      })
      setProducts([])
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const handleBrandSelect = (brand: string) => {
    setSelectedBrand(brand)
    setSelectedJob(null)
    setProducts([])
    setSelectedProducts([])
    setQueries([])
    setSelectedQueries([])
    setQueriesExist(false)
    
    // Filter jobs by selected brand
    const brandJobs = jobs.filter(job => job.brand_name === brand)
    setFilteredJobs(brandJobs)
    
    // Store in localStorage
    localStorage.setItem('selectedBrand', brand)
    localStorage.removeItem('selectedJobId')
    localStorage.removeItem('selectedProducts')
  }

  const handleJobSelect = (job: ScrapeJob) => {
    setSelectedJob(job)
    setSelectedProducts([])
    setQueries([])
    setSelectedQueries([])
    setQueriesExist(false)
    fetchProducts(job.job_id)
    
    // Store in localStorage
    localStorage.setItem('selectedJobId', job.job_id)
    localStorage.removeItem('selectedProducts')
  }

  const handleProductSelectionChange = (newSelection: number[]) => {
    setSelectedProducts(newSelection)
    // Clear queries when products change
    setQueries([])
    setSelectedQueries([])
    setQueriesExist(false)
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

    if (!selectedJob) {
      toast({
        title: "Error",
        description: "Please select a job first",
        variant: "destructive",
      })
      return
    }

    // Store in localStorage for persistence
    localStorage.setItem('selectedBrand', selectedBrand)
    localStorage.setItem('selectedJobId', selectedJob.job_id)
    localStorage.setItem('selectedProducts', JSON.stringify(selectedProducts))

    await checkExistingQueries(selectedJob.job_id, selectedProducts)
  }

  const checkExistingQueries = async (jobId: string, productIds: number[]) => {
    try {
      const response = await fetch(`/api/queries/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: productIds }),
      })
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
    if (!selectedJob) return

    setIsGeneratingQueries(true)
    try {
      const response = await fetch("/api/generate-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: selectedJob.job_id,
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
          checkExistingQueries(selectedJob.job_id, selectedProducts)
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

    if (!selectedJob) return

    try {
      const response = await fetch("/api/process-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: selectedJob.job_id,
          query_ids: selectedQueries,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Query processing started! Redirecting to results page...",
        })
        setTimeout(() => router.push("/results"), 1500)
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 md:px-8 py-12 max-w-5xl">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
            Select Products & Queries
          </h1>
          <p className="text-muted-foreground text-base">Choose products and create queries for AI analysis</p>
        </div>

        {brands.length === 0 ? (
          <Card className="bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-white/60 shadow-lg dark:bg-white/5 dark:border-white/10">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No successful jobs found. Please submit a URL first.</p>
              <p className="text-sm text-muted-foreground">Please submit a URL on the Home page to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Brand and Job Selection */}
            <Card className="mb-8 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-white/60 shadow-lg dark:bg-white/5 dark:border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Select Brand & Job</CardTitle>
                  <Button size="sm" variant="outline" onClick={fetchJobs}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Brand Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brand</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => handleBrandSelect(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10"
                    >
                      <option value="">Select a brand...</option>
                      {brands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Job Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Job</label>
                    <select
                      value={selectedJob?.job_id || ""}
                      onChange={(e) => {
                        const selectedJobId = e.target.value
                        const job = filteredJobs.find(j => j.job_id === selectedJobId)
                        if (job) handleJobSelect(job)
                      }}
                      disabled={!selectedBrand}
                      className="w-full h-11 px-3 rounded-xl bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10 disabled:opacity-50"
                    >
                      <option value="">Select a job...</option>
                      {filteredJobs.map((job) => (
                        <option key={job.job_id} value={job.job_id}>
                          {new Date(job.created_at).toLocaleDateString()} - {job.source_url?.slice(0, 50)}...
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Selection */}
            {selectedJob && (
              <Card className="mb-8 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-white/60 shadow-lg dark:bg-white/5 dark:border-white/10">
                <CardHeader>
                  <CardTitle>Select Products</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingProducts ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Loading products...</p>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No products found for this job.</p>
                    </div>
                  ) : (
                    <>
                      <ProductSelector
                        products={products}
                        selectedProducts={selectedProducts}
                        onSelectionChange={handleProductSelectionChange}
                        disabled={false}
                      />
                      {selectedProducts.length > 0 && (
                        <div className="mt-4 flex justify-end">
                          <Button onClick={submitProductSelection}>
                            Continue to Queries <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Query Selection */}
            {selectedJob && selectedProducts.length > 0 && (
              <Card className="mb-8 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-white/60 shadow-lg dark:bg-white/5 dark:border-white/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Select & Add Queries
                      <Badge variant="secondary" className="ml-2">
                        {selectedProducts.length} products selected
                      </Badge>
                    </CardTitle>
                    {queriesExist && (
                      <Button size="sm" variant="outline" onClick={() => selectedJob && checkExistingQueries(selectedJob.job_id, selectedProducts)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!queriesExist ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No queries found for the selected products. Generate queries to continue.</p>
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
                            disabled={false}
                          />
                        </div>
                      ))}

                      <div className="mt-6 space-y-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add custom query..."
                            value={customQuery}
                            onChange={(e) => setCustomQuery(e.target.value)}
                            className="h-12 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/50 focus-visible:border-[hsl(var(--accent))]/50"
                          />
                          <Button onClick={addCustomQuery} variant="outline">
                            Add Query
                          </Button>
                        </div>

                        <div className="flex justify-between">
                          <div className="flex gap-2">
                            <Button onClick={generateQueries} variant="outline" disabled={isGeneratingQueries}>
                              {isGeneratingQueries ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              Regenerate Queries
                            </Button>
                          </div>
                          <Button onClick={processQueries} disabled={selectedQueries.length === 0}>
                            Process Queries <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
    </div>
  )
}
