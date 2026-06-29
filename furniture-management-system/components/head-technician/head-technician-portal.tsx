"use client"

import { useAuth } from "@/app/providers"
import { MyStages } from "@/components/head-technician/my-stages"

export function HeadTechnicianPortal() {
  const { user } = useAuth()

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">Work queue</p>
        <p className="text-xl font-semibold tracking-tight">
          {user?.full_name || user?.username}
        </p>
      </div>
      <MyStages />
    </div>
  )
}
