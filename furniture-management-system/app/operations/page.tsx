import { RoleGuard } from "@/components/auth/role-guard"
import { OperationsPortal } from "@/components/operations/operations-portal"

export default function OperationsPage() {
  return (
    <RoleGuard allowedRole="OPS_MANAGER">
      <OperationsPortal />
    </RoleGuard>
  )
}
