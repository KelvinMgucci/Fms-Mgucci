import api from "./api"

export type UserRole =
  | "FRONT_DESK"
  | "DIRECTOR"
  | "OPS_MANAGER"
  | "TECHNICIAN"
  | "STOCK_KEEPER"

export interface AuthUser {
  id: number
  username: string
  full_name: string
  first_name: string
  last_name: string
  role: UserRole
  branch_id: number | null
  phone_number: string
}

export const ROLE_PORTAL: Record<UserRole, string> = {
  FRONT_DESK: "/front-desk",
  DIRECTOR: "/director",
  OPS_MANAGER: "/operations",
  TECHNICIAN: "/head-technician",
  STOCK_KEEPER: "/stock-keeper",
}

interface AuthResponse {
  user: AuthUser
}

/** POST /api/auth/login/ — server sets access_token + refresh_token cookies */
export async function login(username: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>("/auth/login/", { username, password })
  return data.user
}

/** GET /api/auth/me/ — returns user from the access_token cookie */
export async function getMe(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<AuthResponse>("/auth/me/")
    return data.user
  } catch {
    return null
  }
}

/** POST /api/auth/logout/ — server clears cookies and revokes session */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout/")
  } catch {
    // best-effort
  }
}
