"use client"

import { Warehouse } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function StockKeeperPortal() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Warehouse className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Stock Keeper Portal
          </h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Maintain the inventory ledger and issue materials against orders.
          </p>
        </div>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Coming soon — API integration in progress.
        </CardContent>
      </Card>
    </div>
  )
}
