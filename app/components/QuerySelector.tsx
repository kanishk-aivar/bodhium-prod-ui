"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Query } from "../lib/types"

interface QuerySelectorProps {
  queries: Query[]
  selectedQueries: number[]
  onSelectionChange: (selected: number[]) => void
  disabled?: boolean
}

export default function QuerySelector({
  queries,
  selectedQueries,
  onSelectionChange,
  disabled = false,
}: QuerySelectorProps) {
  const toggleQuery = (queryId: number) => {
    if (disabled) return

    if (selectedQueries.includes(queryId)) {
      onSelectionChange(selectedQueries.filter((id) => id !== queryId))
    } else {
      onSelectionChange([...selectedQueries, queryId])
    }
  }

  const selectAll = () => {
    if (disabled) return
    onSelectionChange(queries.map((q) => q.query_id))
  }

  const selectNone = () => {
    if (disabled) return
    onSelectionChange([])
  }

  const getQueryTypeColor = (type: string) => {
    switch (type) {
      case "product":
        return "bg-blue-100 text-blue-800"
      case "market":
        return "bg-green-100 text-green-800"
      case "custom":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {selectedQueries.length} of {queries.length} queries selected
          </span>
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>
              Select All
            </Button>
            <Button size="sm" variant="outline" onClick={selectNone}>
              Select None
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {queries.map((query) => {
          const isSelected = selectedQueries.includes(query.query_id)

          return (
            <Card
              key={query.query_id}
              className={`transition-colors ${isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleQuery(query.query_id)}
                    disabled={disabled}
                    className="mt-1"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-900 leading-relaxed">{query.query_text}</p>
                      <Badge className={getQueryTypeColor(query.query_type || "unknown")}>
                        {query.query_type || "unknown"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {queries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No queries available. Queries will appear here after generation.</p>
          </div>
        )}
      </div>
    </div>
  )
}
