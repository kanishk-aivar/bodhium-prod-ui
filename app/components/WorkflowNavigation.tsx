"use client"

import { CheckCircle, ExternalLink } from "lucide-react"

interface WorkflowNavigationProps {
  currentStep: number
}

export default function WorkflowNavigation({ currentStep }: WorkflowNavigationProps) {
  const steps = [
    { number: 1, label: "Submit URL" },
    { number: 2, label: "Scraping" },
    { number: 3, label: "Select Products" },
    { number: 4, label: "Select Queries" },
    { number: 5, label: "Processing" },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-center space-x-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    currentStep > step.number
                      ? "bg-green-500 border-green-500 text-white"
                      : currentStep === step.number
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-gray-100 border-gray-300 text-gray-500"
                  }`}
                >
                  {currentStep > step.number ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.number}</span>
                  )}
                </div>
                <span className={`text-xs mt-1 ${currentStep >= step.number ? "text-gray-900" : "text-gray-500"}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${currentStep > step.number ? "bg-green-500" : "bg-gray-300"}`} />
              )}
            </div>
          ))}

          {/* Results Button - Always Visible */}
          <div className="flex items-center ml-8">
            <div className="w-12 h-0.5 bg-gray-300" />
            <button
              onClick={() => window.open("/results", "_blank")}
              className="flex flex-col items-center ml-4 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 bg-purple-500 border-purple-500 text-white">
                <ExternalLink className="w-4 h-4" />
              </div>
              <span className="text-xs mt-1 text-gray-900">Results</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
