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
          <span className="text-sm text-muted-foreground">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-hidden">
        {products.map((product) => {
          const isSelected = selectedProducts.includes(product.product_id)
          const isExpanded = expandedProducts.has(product.product_id)
          const productName = getProductName(product.product_data)
          const productPrice = getProductPrice(product.product_data)
          const productImage = getProductImage(product.product_data)

          return (
            <Card
              key={product.product_id}
              className={`w-full rounded-xl border border-white/60 bg-white/60 backdrop-blur-md shadow-sm transition-colors ${
                isSelected
                  ? "ring-2 ring-[hsl(var(--accent))] bg-white/70 dark:bg-[hsl(var(--accent))]/10"
                  : "hover:bg-white/70 dark:bg-white/5 dark:border-white/10"
              }`}
            >
              <CardContent className="p-0">
                <div className="relative">
                  {productImage ? (
                    <img
                      src={productImage}
                      alt={productName}
                      className="w-full h-40 object-cover rounded-t-xl border-b border-white/60"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=160&width=320"
                      }}
                    />
                  ) : (
                    <div className="w-full h-40 rounded-t-xl border-b border-white/60 dark:border-white/10 bg-muted dark:bg-white/10" />
                  )}
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleProduct(product.product_id)}
                      disabled={disabled}
                      className="bg-white/70 backdrop-blur rounded-md"
                    />
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-medium line-clamp-2">{productName}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{product.brand_name}</p>
                  <div className="flex items-center justify-between">
                    {productPrice ? (
                      <Badge variant="secondary">${productPrice}</Badge>
                    ) : (
                      <span />
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleExpanded(product.product_id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 p-3 rounded-lg bg-secondary/60 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">
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
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
