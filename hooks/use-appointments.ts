"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetcher } from "@/lib/fetcher"
import type { Appointment } from "@/types"

interface AppointmentsResponse {
  success: boolean
  appointments: Appointment[]
  restDays?: string[]
}

export function useAppointments(params?: { date?: string; month?: string }) {
  const search = new URLSearchParams()
  if (params?.date) search.set("date", params.date)
  if (params?.month) search.set("month", params.month)
  const url = `/api/appointments${search.toString() ? `?${search}` : ""}`

  const { data, isLoading, error } = useQuery<AppointmentsResponse>({
    queryKey: ["appointments", params],
    queryFn: () => fetcher(url),
    staleTime: 20_000,
  })

  return {
    appointments: data?.appointments ?? [],
    restDays: data?.restDays ?? [],
    isLoading,
    error: error as Error | null,
  }
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}

export function useAddAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["patients"] })
    },
  })
}
