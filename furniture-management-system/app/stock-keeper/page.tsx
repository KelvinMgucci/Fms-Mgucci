import { RoleGuard } from "@/components/auth/role-guard"
import { StockKeeperPortal } from "@/components/stock-keeper/stock-keeper-portal"

export default function StockKeeperPage() {
  return (
    <RoleGuard allowedRole="STOCK_KEEPER">
      <StockKeeperPortal />
    </RoleGuard>
  )
}
