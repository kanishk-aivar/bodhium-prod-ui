"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Download, Search, CheckCircle, XCircle, Clock, Loader2, ArrowLeft, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "../hooks/use-toast"
import type { GroupedResults, JobWithTasks, LLMTask } from "../lib/types"

export default function ResultsPage() {
  const [groupedResults, setGroupedResults] = useState<GroupedResults>({})
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)

  const { toast } = useToast()

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    try {
      const response = await fetch("/api/results")
      const data = await response.json()
      setGroupedResults(data)
      
      // Auto-expand jobs with recent activity
      const recentJobs = Object.keys(data).filter(jobId => {
        const job = data[jobId]
        const hasRecentTasks = job.tasks.some((task: LLMTask) => {
          const taskDate = new Date(task.created_at)
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          return taskDate > oneDayAgo
        })
        return hasRecentTasks
      })
      setExpandedJobs(new Set(recentJobs.slice(0, 3))) // Expand up to 3 recent jobs
      
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

  const downloadResults = async (taskId: string, modelName: string) => {
    try {
      const response = await fetch(`/api/download/${taskId}`)
      const data = await response.json()

      if (response.ok && data.download_url) {
        const filename = data.filename || `${modelName}_${taskId}_results.${data.is_zip ? "zip" : "json"}`

        const link = document.createElement("a")
        link.href = data.download_url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast({
          title: "Success",
          description: "Download started!",
        })
      } else {
        throw new Error(data.error || "Download failed")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download results",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = (status: string | null) => {
    const value = status || "unknown"
    switch (value) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string | null) => {
    const value = status || "unknown"
    switch (value) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "failed":
        return "bg-red-100 text-red-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  const toggleJobExpansion = (jobId: string) => {
    const newExpanded = new Set(expandedJobs)
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId)
    } else {
      newExpanded.add(jobId)
    }
    setExpandedJobs(newExpanded)
  }

  const getJobStats = (tasks: LLMTask[]) => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === "completed").length
    const failed = tasks.filter((t) => t.status === "failed").length
    const processing = tasks.filter((t) => t.status === "processing").length
    const pending = tasks.filter((t) => t.status === "created").length

    return { total, completed, failed, processing, pending }
  }

  const filteredResults = Object.entries(groupedResults).filter(([jobId, jobData]) => {
    const matchesSearch = 
      jobData.job.brand_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jobData.job.source_url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jobId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jobData.tasks.some(task => 
        task.llm_model_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    
    const hasMatchingTasks = statusFilter === "all" || 
      jobData.tasks.some(task => task.status === statusFilter)
    
    return matchesSearch && hasMatchingTasks
  })

  const getFilteredTasks = (tasks: LLMTask[]) => {
    if (statusFilter === "all") return tasks
    return tasks.filter(task => task.status === statusFilter)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Results Dashboard</h1>
            <p className="text-gray-600">View and download your AI processing results, grouped by job</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchResults}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => window.close()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search jobs, tasks, or models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="created">Pending</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Results grouped by job */}
        <div className="space-y-6">
          {filteredResults.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Results Found</h3>
                <p className="text-gray-600">
                  {Object.keys(groupedResults).length === 0 
                    ? "No jobs with LLM tasks found"
                    : "No jobs match your search criteria"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredResults.map(([jobId, jobData]) => {
              const isExpanded = expandedJobs.has(jobId)
              const stats = getJobStats(jobData.tasks)
              const filteredTasks = getFilteredTasks(jobData.tasks)

              return (
                <Card key={jobId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleJobExpansion(jobId)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <div>
                          <CardTitle className="text-lg">
                            {jobData.job.brand_name || "Unknown Brand"}
                          </CardTitle>
                          <p className="text-sm text-gray-500">
                            Job ID: {jobId.slice(0, 8)}... • Created: {new Date(jobData.job.created_at).toLocaleDateString()}
                          </p>
                          {jobData.job.source_url && (
                            <p className="text-xs text-gray-400 truncate max-w-lg">
                              {jobData.job.source_url}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-green-600">{stats.completed}</p>
                            <p className="text-xs text-gray-500">Done</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-blue-600">{stats.processing}</p>
                            <p className="text-xs text-gray-500">Running</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-red-600">{stats.failed}</p>
                            <p className="text-xs text-gray-500">Failed</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-600">{stats.total}</p>
                            <p className="text-xs text-gray-500">Total</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(jobData.job.status)}>
                          {jobData.job.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent>
                      <div className="space-y-4">
                        {filteredTasks.map((task) => (
                          <div key={task.task_id} className="p-4 border rounded-lg bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                {getStatusIcon(task.status)}
                                <div>
                                  <p className="font-medium">{task.llm_model_name || "Unknown Model"}</p>
                                  <p className="text-sm text-gray-500">Task ID: {task.task_id.slice(0, 8)}...</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                                {task.status === "completed" && task.s3_output_path && (
                                  <Button
                                    size="sm"
                                    onClick={() => downloadResults(task.task_id, task.llm_model_name || "unknown")}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="text-sm text-gray-600">
                              <p>Created: {new Date(task.created_at).toLocaleString()}</p>
                              {task.completed_at && <p>Completed: {new Date(task.completed_at).toLocaleString()}</p>}
                              {task.error_message && <p className="text-red-600 mt-1">Error: {task.error_message}</p>}
                            </div>
                          </div>
                        ))}

                        {filteredTasks.length === 0 && statusFilter !== "all" && (
                          <p className="text-gray-500 text-center py-4">
                            No tasks with status "{statusFilter}" found for this job
                          </p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}