"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Download, Search, CheckCircle, XCircle, Clock, Loader2, ArrowLeft, RefreshCw } from "lucide-react"
import { useToast } from "../hooks/use-toast"
import type { ScrapeJob, LLMTask } from "../lib/types"

export default function ResultsPage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [tasks, setTasks] = useState<LLMTask[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)

  const { toast } = useToast()

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    if (selectedJob) {
      fetchTasks(selectedJob)
    }
  }, [selectedJob])

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs")
      const data = await response.json()
      setJobs(data.filter((job: ScrapeJob) => job.status === "JOB_SUCCESS" || job.status === "llm_generated"))
      setIsLoading(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const fetchTasks = async (jobId: string) => {
    try {
      const response = await fetch(`/api/tasks/${jobId}`)
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      })
    }
  }

  const downloadResults = async (taskId: string, modelName: string) => {
    try {
      const response = await fetch(`/api/download/${taskId}`)
      const data = await response.json()

      if (response.ok && data.download_url) {
        // Force download (no new tab) and prefer server-provided filename if available
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

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.llm_model_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getTaskStats = () => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === "completed").length
    const failed = tasks.filter((t) => t.status === "failed").length
    const processing = tasks.filter((t) => t.status === "processing").length
    const pending = tasks.filter((t) => t.status === "created").length

    return { total, completed, failed, processing, pending }
  }

  const getSelectedJobName = () => {
    const job = jobs.find((j) => j.job_id === selectedJob)
    return job?.brand_name || "Unknown Job"
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
            <p className="text-gray-600">View and download your AI processing results</p>
            {selectedJob && (
              <p className="text-sm text-blue-600 mt-1">
                Viewing results for: <strong>{getSelectedJobName()}</strong>
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => window.close()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jobs List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Completed Jobs
                <Button size="sm" variant="outline" onClick={fetchJobs}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.job_id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedJob === job.job_id ? "bg-blue-50 border-blue-200" : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedJob(job.job_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{job.brand_name}</p>
                        <p className="text-xs text-gray-500">{new Date(job.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && <p className="text-gray-500 text-center py-4">No completed jobs found</p>}
              </div>
            </CardContent>
          </Card>

          {/* Tasks Results */}
          <div className="lg:col-span-2 space-y-6">
            {selectedJob ? (
              <>
                {/* Stats Cards */}
                {tasks.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(getTaskStats()).map(([key, value]) => (
                      <Card key={key}>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{value}</p>
                          <p className="text-sm text-gray-600 capitalize">{key}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Filters */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Input
                          placeholder="Search tasks..."
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

                {/* Tasks List */}
                <Card>
                  <CardHeader>
                    <CardTitle>LLM Processing Tasks - {getSelectedJobName()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {filteredTasks.map((task) => (
                        <div key={task.task_id} className="p-4 border rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(task.status)}
                              <div>
                                <p className="font-medium">{task.llm_model_name}</p>
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

                      {filteredTasks.length === 0 && tasks.length > 0 && (
                        <p className="text-gray-500 text-center py-4">No tasks match your filters</p>
                      )}

                      {tasks.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No tasks found for this job</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select a Job</h3>
                  <p className="text-gray-600">Choose a completed job from the left to view its results</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
