/**
 * Generic fetcher for React Query.
 * Throws on non-OK responses so React Query treats them as errors.
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}
