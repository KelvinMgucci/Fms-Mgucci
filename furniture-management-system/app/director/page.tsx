import { RoleGuard } from "@/components/auth/role-guard"
import { DirectorPortal } from "@/components/director/director-portal"

export default function DirectorPage() {
  return (
    <RoleGuard allowedRole="DIRECTOR">
      <DirectorPortal />
    </RoleGuard>
  )
}
