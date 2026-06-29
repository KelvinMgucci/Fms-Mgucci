"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Delete, Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

import api from "@/lib/api"
import type { AuthUser } from "@/lib/auth"
import { useAuth } from "@/app/providers"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const PIN_LENGTH = 4

type ApiError = { response?: { data?: { detail?: string } } }

export default function SettingsPage() {
  const { user } = useAuth()
  const isTechnician = user?.role === "TECHNICIAN"

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile information and {isTechnician ? "PIN" : "password"}.
        </p>
      </div>

      <ProfileCard />
      {isTechnician ? <PinCard /> : <PasswordCard />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile — shared by all roles
// ---------------------------------------------------------------------------

function ProfileCard() {
  const { user, setUser } = useAuth()
  const [firstName, setFirstName] = useState(user?.first_name ?? "")
  const [lastName, setLastName]   = useState(user?.last_name ?? "")
  const [phone, setPhone]         = useState(user?.phone_number ?? "")

  const save = useMutation({
    mutationFn: () =>
      api.patch<{ user: AuthUser }>("/auth/profile/", {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
      }),
    onSuccess: ({ data }) => {
      setUser(data.user)
      toast.success("Profile updated.")
    },
    onError: () => toast.error("Failed to save profile."),
  })

  const dirty =
    firstName !== (user?.first_name ?? "") ||
    lastName  !== (user?.last_name ?? "")  ||
    phone     !== (user?.phone_number ?? "")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name and contact number.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="first-name">First name</FieldLabel>
            <Input
              id="first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="last-name">Last name</FieldLabel>
            <Input
              id="last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input id="username" value={user?.username ?? ""} disabled />
          <FieldDescription>Username cannot be changed.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">Phone number</FieldLabel>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="+255 7xx xxx xxx"
          />
        </Field>
      </CardContent>

      <CardFooter className="justify-end">
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Password — staff roles
// ---------------------------------------------------------------------------

interface PwFields { current: string; next: string; confirm: string }

function PasswordCard() {
  const [fields, setFields] = useState<PwFields>({ current: "", next: "", confirm: "" })
  const [show, setShow]     = useState({ current: false, next: false, confirm: false })
  const [error, setError]   = useState<string | null>(null)

  const patch = (key: keyof PwFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setFields((f) => ({ ...f, [key]: e.target.value }))
  }
  const toggleShow = (key: keyof typeof show) => setShow((s) => ({ ...s, [key]: !s[key] }))

  const change = useMutation({
    mutationFn: () =>
      api.post("/auth/change-password/", {
        current_password: fields.current,
        new_password: fields.next,
      }),
    onSuccess: () => {
      setFields({ current: "", next: "", confirm: "" })
      toast.success("Password updated.")
    },
    onError: (err: ApiError) =>
      setError(err.response?.data?.detail ?? "Failed to change password."),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (fields.next !== fields.confirm) { setError("Passwords do not match."); return }
    if (fields.next.length < 8)         { setError("Minimum 8 characters.");   return }
    change.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Minimum 8 characters.</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {(["current", "next", "confirm"] as const).map((key) => (
            <Field key={key}>
              <FieldLabel htmlFor={key}>
                {key === "current" ? "Current password" : key === "next" ? "New password" : "Confirm new password"}
              </FieldLabel>
              <div className="relative">
                <Input
                  id={key}
                  type={show[key] ? "text" : "password"}
                  value={fields[key]}
                  onChange={patch(key)}
                  className="pr-10"
                  autoComplete={key === "current" ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => toggleShow(key)}
                  aria-label={show[key] ? "Hide" : "Show"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {show[key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          ))}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </CardContent>

        <CardFooter className="justify-end">
          <Button
            type="submit"
            disabled={!fields.current || !fields.next || !fields.confirm || change.isPending}
          >
            {change.isPending && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// PIN — technician role
// ---------------------------------------------------------------------------

type PinStep = "current" | "next" | "confirm"

const PIN_LABELS: Record<PinStep, string> = {
  current: "Enter your current PIN",
  next:    "Enter your new PIN",
  confirm: "Confirm your new PIN",
}

function PinCard() {
  const [step, setStep]       = useState<PinStep>("current")
  const [pins, setPins]       = useState({ current: "", next: "", confirm: "" })
  const [error, setError]     = useState<string | null>(null)

  const change = useMutation({
    mutationFn: (p: { current: string; next: string }) =>
      api.post("/auth/change-password/", {
        current_password: p.current,
        new_password: p.next,
      }),
    onSuccess: () => {
      setPins({ current: "", next: "", confirm: "" })
      setStep("current")
      toast.success("PIN updated.")
    },
    onError: (err: ApiError) => {
      setError(err.response?.data?.detail ?? "Failed to update PIN.")
      setPins({ current: "", next: "", confirm: "" })
      setStep("current")
    },
  })

  function pressDigit(d: string) {
    if (change.isPending) return
    setError(null)
    setPins((prev) => {
      const current = prev[step]
      if (current.length >= PIN_LENGTH) return prev
      const next = current + d

      if (next.length === PIN_LENGTH) {
        // Advance after a short delay so the last dot fills in visually
        setTimeout(() => advance(step, next), 120)
      }
      return { ...prev, [step]: next }
    })
  }

  function advance(s: PinStep, value: string) {
    if (s === "current") {
      setStep("next")
    } else if (s === "next") {
      setStep("confirm")
    } else {
      // confirm — validate and submit
      setPins((prev) => {
        if (value !== prev.next) {
          setError("PINs do not match. Start over.")
          setPins({ current: "", next: "", confirm: "" })
          setStep("current")
          return prev
        }
        change.mutate({ current: prev.current, next: prev.next })
        return prev
      })
    }
  }

  function backspace() {
    setError(null)
    setPins((prev) => ({ ...prev, [step]: prev[step].slice(0, -1) }))
  }

  const currentPin = pins[step]
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change PIN</CardTitle>
        <CardDescription>Your 4-digit workshop PIN.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-5">
        {/* Step indicator */}
        <div className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground">
          {(["current", "next", "confirm"] as PinStep[]).map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground/40">›</span>}
              <span className={cn(step === s ? "font-medium text-foreground" : "")}>
                {s === "current" ? "Current" : s === "next" ? "New" : "Confirm"}
              </span>
            </span>
          ))}
        </div>

        {/* PIN dots */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium">{PIN_LABELS[step]}</p>
          <div className="flex items-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-3.5 rounded-full border-2 transition-colors",
                  i < currentPin.length
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30 bg-transparent"
                )}
              />
            ))}
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
        </div>

        {/* Keypad */}
        <div className="grid w-full max-w-[220px] grid-cols-3 gap-2">
          {keys.map((k) => (
            <Button
              key={k}
              type="button"
              variant="outline"
              className="h-14 text-xl font-medium"
              onClick={() => pressDigit(k)}
              disabled={change.isPending}
            >
              {k}
            </Button>
          ))}
          <span aria-hidden />
          <Button
            type="button"
            variant="outline"
            className="h-14 text-xl font-medium"
            onClick={() => pressDigit("0")}
            disabled={change.isPending}
          >
            0
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14"
            onClick={backspace}
            disabled={currentPin.length === 0}
            aria-label="Delete"
          >
            {change.isPending
              ? <Loader2 className="size-5 animate-spin" />
              : <Delete className="size-5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
