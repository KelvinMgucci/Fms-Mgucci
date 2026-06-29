import { RoleGuard } from "@/components/auth/role-guard"
import { OrdersDashboard } from "@/components/front-desk/orders-dashboard"

export default function FrontDeskPage() {
  return (
    <RoleGuard allowedRole="FRONT_DESK">
      <OrdersDashboard />
    </RoleGuard>
  )
}
