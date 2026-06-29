"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Clock, Hammer, Lock } from "lucide-react"
import { toast } from "sonner"

import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

interface QueueStage {
  id: number
  stage_name: string
  sequence_number: number
  status: "PENDING" | "ACTIVE" | "DONE"
  activated_at: string | null
  completed_at: string | null
  order: {
    id: number
    reference_number: string
    customer_name: string
    item_description: string
    delivery_date: string | null
  }
}

export function MyStages() {
  const queryClient = useQueryClient()

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["my-queue"],
    queryFn: async () => {
      const { data } = await api.get<QueueStage[]>("/production/my-queue/")
      return data
    },
    refetchInterval: 30_000,
  })

  const complete = useMutation({
    mutationFn: (stageId: number) =>
      api.post(`/production/stages/${stageId}/complete/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-queue"] })
      toast.success("Stage complete — next stage activated.")
    },
    onError: () => toast.error("Failed to mark stage complete."),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <Empty className="mt-8">
        <EmptyHeader>
          <EmptyTitle>No stages assigned</EmptyTitle>
          <EmptyDescription>
            The Operations Manager will assign work to you here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {stages.map((stage) => (
        <StageCard
          key={stage.id}
          stage={stage}
          completing={complete.isPending && complete.variables === stage.id}
          onDone={() => complete.mutate(stage.id)}
        />
      ))}
    </div>
  )
}

function StageCard({
  stage,
  completing,
  onDone,
}: {
  stage: QueueStage
  completing: boolean
  onDone: () => void
}) {
  const isActive = stage.status === "ACTIVE"
  const isPending = stage.status === "PENDING"

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden",
        isActive && "border-primary ring-1 ring-primary/30",
        isPending && "opacity-60",
      )}
    >
      <CardHeader className="gap-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {stage.order.reference_number} · {stage.order.customer_name}
          </span>
          <StageStatusBadge status={stage.status} />
        </div>
        <CardTitle className="text-base leading-snug">
          {stage.order.item_description}
        </CardTitle>
        {stage.order.delivery_date && (
          <p className="text-xs text-muted-foreground">
            Due{" "}
            {new Date(stage.order.delivery_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2">
          <Hammer className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">{stage.stage_name}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            #{stage.sequence_number}
          </span>
        </div>

        {isPending && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            Waiting for previous stage to complete.
          </p>
        )}

        {isActive && (
          <Button
            className="h-12 w-full text-base"
            onClick={onDone}
            disabled={completing}
          >
            <CheckCircle2 data-icon="inline-start" />
            {completing ? "Saving…" : "Mark done"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function StageStatusBadge({ status }: { status: QueueStage["status"] }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="gap-1 border-transparent bg-primary text-primary-foreground">
        <Hammer className="size-3" />
        In progress
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Clock className="size-3" />
      Pending
    </Badge>
  )
}
