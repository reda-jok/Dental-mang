"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetcher } from "@/lib/fetcher"
import type { ProcedureType } from "@/types"

interface ProcedureTypesResponse {
  success: boolean
  procedureTypes: ProcedureType[]
}

export function useProcedureTypes() {
  const { data, isLoading, error } = useQuery<ProcedureTypesResponse>({
    queryKey: ["procedure-types"],
    queryFn: () => fetcher("/api/procedure-types"),
    staleTime: 60_000,
  })

  return {
    procedureTypes: data?.procedureTypes ?? [],
    isLoading,
    error: error as Error | null,
  }
}

export function useAddProcedureType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/procedure-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedure-types"] })
    },
  })
}
