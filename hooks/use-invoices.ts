"use client"

import { useQuery } from "@tanstack/react-query"
import { fetcher } from "@/lib/fetcher"
import type { Invoice } from "@/types"

interface InvoicesResponse {
  success: boolean
  invoices: Invoice[]
}

export function useInvoices() {
  const { data, isLoading, error } = useQuery<InvoicesResponse>({
    queryKey: ["invoices"],
    queryFn: () => fetcher("/api/invoices"),
    staleTime: 20_000,
  })

  return {
    invoices: data?.invoices ?? [],
    isLoading,
    error: error as Error | null,
  }
}
