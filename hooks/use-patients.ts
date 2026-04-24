"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetcher } from "@/lib/fetcher"
import type { Patient } from "@/types"

interface PatientsResponse {
  success: boolean
  patients: Patient[]
}

export function usePatients() {
  const { data, isLoading, error } = useQuery<PatientsResponse>({
    queryKey: ["patients"],
    queryFn: () => fetcher("/api/patients"),
    staleTime: 30_000,
  })

  return {
    patients: data?.patients ?? [],
    isLoading,
    error: error as Error | null,
  }
}

export function useAddPatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] })
    },
  })
}
