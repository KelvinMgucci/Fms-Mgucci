import { RoleGuard } from "@/components/auth/role-guard"
import { HeadTechnicianPortal } from "@/components/head-technician/head-technician-portal"

export default function HeadTechnicianPage() {
  return (
    <RoleGuard allowedRole="TECHNICIAN">
      <HeadTechnicianPortal />
    </RoleGuard>
  )
}
