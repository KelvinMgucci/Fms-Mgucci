"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "@/app/providers"
import { ROLE_PORTAL, type UserRole } from "@/lib/auth"

interface RoleGuardProps {
  allowedRole: UserRole
  children: React.ReactNode
}

/**
 * Wrap any portal page with this HOC to enforce role-based access.
 * If the authenticated user has a different role they are redirected to
 * their own portal; unauthenticated users are sent to /login.
 */
export function RoleGuard({ allowedRole, children }: RoleGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (user.role !== allowedRole) {
      router.replace(ROLE_PORTAL[user.role])
    }
  }, [user, loading, allowedRole, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || user.role !== allowedRole) return null

  return <>{children}</>
}
