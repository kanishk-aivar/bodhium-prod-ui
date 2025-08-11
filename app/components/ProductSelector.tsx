"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { Product } from "../lib/types"

interface ProductSelectorProps {
  products: Product[]
  selectedProducts: number[]
  onSelectionChange: (selected: number[]) => void
  disabled?: boolean
}

export default function ProductSelector({
  products,
  selectedProducts,
  onSelectionChange,
  disabled = false,
}: ProductSelectorProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())

  const toggleProduct = (productId: number) => {
    if (disabled) return

    if (selectedProducts.includes(productId)) {
      onSelectionChange(selectedProducts.filter((id) => id !== productId))
    } else {
      onSelectionChange([...selectedProducts, productId])
    }
  }

  const toggleExpanded = (productId: number) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
    }
    setExpandedProducts(newExpanded)
  }

  const selectAll = () => {
    if (disabled) return
    onSelectionChange(products.map((p) => p.product_id))
  }

  const selectNone = () => {
    if (disabled) return
    onSelectionChange([])
  }

  const getProductName = (productData: any) => {
    if (typeof productData === "string") {
      try {
        productData = JSON.parse(productData)
      } catch {
        return "Unknown Product"
      }
    }
    // Fix: Use productname instead of name
    return productData?.productname || productData?.name || productData?.title || "Unknown Product"
  }

  const getProductPrice = (productData: any) => {
    if (typeof productData === "string") {
      try {
        productData = JSON.parse(productData)
      } catch {
        return null
      }
    }
    return productData?.price || productData?.cost || null
  }

  const getProductImage = (productData: any) => {
    if (typeof productData === "string") {
      try {
        productData = JSON.parse(productData)
      } catch {
        return null
      }
    }
    return productData?.image || productData?.image_url || null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {selectedProducts.length} of {products.length} products selected
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
        {products.map((product) => {
          const isSelected = selectedProducts.includes(product.product_id)
          const isExpanded = expandedProducts.has(product.product_id)
          const productName = getProductName(product.product_data)
          const productPrice = getProductPrice(product.product_data)
          const productImage = getProductImage(product.product_data)

          return (
            <Card
              key={product.product_id}
              className={`transition-colors ${isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleProduct(product.product_id)}
                    disabled={disabled}
                    className="mt-1"
                  />

                  {productImage && (
                    <img
                      src={productImage || "/placeholder.svg"}
                      alt={productName}
                      className="w-16 h-16 object-cover rounded-md"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=64&width=64"
                      }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 truncate">{productName}</h3>
                        <p className="text-sm text-gray-500 truncate">{product.brand_name}</p>
                        {productPrice && (
                          <Badge variant="secondary" className="mt-1">
                            ${productPrice}
                          </Badge>
                        )}
                      </div>

                      <Button size="sm" variant="ghost" onClick={() => toggleExpanded(product.product_id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(
                            typeof product.product_data === "string"
                              ? JSON.parse(product.product_data)
                              : product.product_data,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
