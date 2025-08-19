"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Search, Loader2, RefreshCw, Eye, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { useToast } from "../hooks/use-toast"
import { ResponseContent } from "@/components/ui/response-content"
import JSZip from "jszip"
import type { NewResultsResponse, ProductResult, S3WorkerResult, ScrapeJob } from "../lib/types"

interface TableRow {
  id: string
  brand: string
  productName: string
  query: string
  workerType: string
  fullResult: S3WorkerResult
}

export default function ResultsPage() {
  const [results, setResults] = useState<NewResultsResponse>({ products: [], total_results: 0 })
  const [tableData, setTableData] = useState<TableRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [workerFilter, setWorkerFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>("all")
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  
  const ROWS_PER_PAGE = 30

  const { toast } = useToast()

  useEffect(() => {
    fetchJobs()
    fetchResults()
  }, [])

  useEffect(() => {
    // Transform products data into table rows
    const rows: TableRow[] = []
    
    results.products.forEach((product) => {
      product.workers.forEach((worker) => {
        worker.results.forEach((result) => {
          rows.push({
            id: `${product.product_id}-${worker.worker_type}-${result.query_id}`,
            brand: product.brand_name || "Unknown Brand",
            productName: product.product_name || `Product ${product.product_id}`,
            query: result.query,
            workerType: worker.worker_type,
            fullResult: result
          })
        })
      })
    })
    
    setTableData(rows)
  }, [results])

  const fetchJobs = async () => {
    try {
      setIsLoadingJobs(true)
      const response = await fetch("/api/jobs")
      const data = await response.json()
      
      if (Array.isArray(data)) {
        const successfulJobs = data.filter((job: ScrapeJob) => job.status === "JOB_SUCCESS")
        setJobs(successfulJobs)
      } else {
        setJobs([])
      }
    } catch (error) {
      console.error("Error fetching jobs:", error)
      setJobs([])
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      })
    } finally {
      setIsLoadingJobs(false)
    }
  }

  const fetchResults = async (jobId?: string) => {
    try {
      setIsLoading(true)
      const url = jobId && jobId !== "all" ? `/api/results-v2?job_id=${jobId}` : "/api/results-v2"
      const response = await fetch(url)
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

  const filteredData = tableData.filter((row) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = (
      row.brand.toLowerCase().includes(searchLower) ||
      row.productName.toLowerCase().includes(searchLower) ||
      row.query.toLowerCase().includes(searchLower) ||
      row.workerType.toLowerCase().includes(searchLower) ||
      row.fullResult.content.toLowerCase().includes(searchLower)
    )
    
    const matchesBrand = brandFilter === "all" || row.brand === brandFilter
    const matchesWorker = workerFilter === "all" || row.workerType === workerFilter
    
    return matchesSearch && matchesBrand && matchesWorker
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE)
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE
  const endIndex = startIndex + ROWS_PER_PAGE
  const paginatedData = filteredData.slice(startIndex, endIndex)

  // Get unique values for filters
  const uniqueBrands = Array.from(new Set(tableData.map(row => row.brand))).sort()
  const uniqueWorkers = Array.from(new Set(tableData.map(row => row.workerType))).sort()

  // Get jobs filtered by selected brand
  const filteredJobs = brandFilter === "all" 
    ? jobs 
    : jobs.filter(job => job.brand_name === brandFilter)

  // Handle job selection change
  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId)
    fetchResults(jobId === "all" ? undefined : jobId)
  }

  // Handle brand filter change - reset job selection when brand changes
  const handleBrandFilterChange = (brand: string) => {
    setBrandFilter(brand)
    setSelectedJobId("all")
    fetchResults()
  }

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, brandFilter, workerFilter, selectedJobId])

  const getWorkerBadgeColor = (workerType: string) => {
    switch (workerType) {
      case "aio":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20"
      case "aim":
        return "bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/20"
      case "perplexity":
        return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20"
      case "chatgpt":
        return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/20"
      default:
        return "bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/20"
    }
  }

  const getWorkerDisplayName = (workerType: string) => {
    switch (workerType) {
      case "aio":
        return "Google AI Overview"
      case "aim":
        return "Google AI Mode"
      case "perplexity":
        return "Perplexity"
      case "chatgpt":
        return "ChatGPT"
      default:
        return workerType.toUpperCase()
    }
  }



  const downloadQueryResult = async (result: S3WorkerResult, productName: string, brand: string) => {
    try {
      const zip = new JSZip()
      
      // Create a filename-safe string
      const safeProductName = productName.replace(/[^a-z0-9]/gi, '_')
      const safeBrand = brand.replace(/[^a-z0-9]/gi, '_')
      const timestamp = new Date(result.timestamp).toISOString().split('T')[0]
      
      // Add the main content
      const mainContent = result.formatted_markdown || result.content
      const fileExtension = result.formatted_markdown ? 'md' : 'txt'
      
      zip.file(
        `${safeBrand}_${safeProductName}_${result.model}_query_${result.query_id}.${fileExtension}`,
        mainContent
      )
      
      // Add metadata as JSON
      const metadata = {
        query: result.query,
        model: result.model,
        timestamp: result.timestamp,
        brand: brand,
        product: productName,
        query_id: result.query_id,
        job_id: result.job_id,
        product_id: result.product_id,
        links: result.links || [],
        related_questions: result.related_questions || [],
        metadata: result.metadata || {}
      }
      
      zip.file(
        `${safeBrand}_${safeProductName}_${result.model}_query_${result.query_id}_metadata.json`,
        JSON.stringify(metadata, null, 2)
      )
      
      // Generate and download the zip
      const content = await zip.generateAsync({ type: "blob" })
      const url = window.URL.createObjectURL(content)
      const link = document.createElement("a")
      link.href = url
      link.download = `${safeBrand}_${safeProductName}_${result.model}_${timestamp}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Success",
        description: "Query result downloaded successfully!",
      })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Error",
        description: "Failed to download query result",
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
    <div className="container mx-auto px-6 md:px-8 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2 bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
            AI Results Dashboard
          </h1>
          <p className="text-muted-foreground">
            View detailed AI processing results organized by product and query
          </p>
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>{results.total_results} products</span>
            <span>{tableData.length} total results</span>
            <span>{filteredData.length} filtered results</span>
            {totalPages > 1 && (
              <span>Page {currentPage} of {totalPages}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            fetchJobs()
            fetchResults(selectedJobId === "all" ? undefined : selectedJobId)
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

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
              <div className="flex gap-4">
                <select
                  value={brandFilter}
                  onChange={(e) => handleBrandFilterChange(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm"
                >
                  <option value="all">All Brands</option>
                  {uniqueBrands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>

                <select
                  value={selectedJobId}
                  onChange={(e) => handleJobChange(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoadingJobs || brandFilter === "all"}
                >
                  <option value="all">All Jobs</option>
                  {filteredJobs.map((job) => (
                    <option key={job.job_id} value={job.job_id}>
                      {new Date(job.created_at).toLocaleDateString()} - {job.source_url?.slice(0, 40)}...
                    </option>
                  ))}
                </select>
                
                <select
                  value={workerFilter}
                  onChange={(e) => setWorkerFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white/60 dark:bg-white/10 border-white/60 dark:border-white/10 text-sm"
                >
                  <option value="all">All AI Models</option>
                  {uniqueWorkers.map((worker) => (
                    <option key={worker} value={worker}>{getWorkerDisplayName(worker)}</option>
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
          <CardTitle className="text-lg">AI Processing Results</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Results Found</h3>
              <p className="text-muted-foreground">
                {tableData.length === 0 
                  ? "No AI processing results available"
                  : "No results match your search criteria"
                }
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Brand</TableHead>
                      <TableHead className="w-[250px]">Product Name</TableHead>
                      <TableHead className="w-[350px]">Query</TableHead>
                      <TableHead className="w-[150px]">AI Model</TableHead>
                      <TableHead className="w-[100px]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <div className="max-w-[150px]">
                          <p className="truncate" title={row.brand}>
                            {row.brand}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[250px]">
                          <p className="truncate" title={row.productName}>
                            {row.productName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[350px]">
                          <p className="truncate" title={row.query}>
                            {row.query}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getWorkerBadgeColor(row.workerType)}>
                          {getWorkerDisplayName(row.workerType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedRow(row)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
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

      {/* Response Details Sheet */}
      <Sheet open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent 
          className="overflow-y-auto" 
          side="right"
          resizable
          defaultWidth={900}
          minWidth={500}
          maxWidth={1000}
        >
          {selectedRow && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">
                  {selectedRow.brand} - {selectedRow.productName}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <ResponseContent
                  result={selectedRow.fullResult}
                  productName={selectedRow.productName}
                  brand={selectedRow.brand}
                  onDownload={downloadQueryResult}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}