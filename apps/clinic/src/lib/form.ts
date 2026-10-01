"use client"

import { useTranslations } from "next-intl"
import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form"
import { toast } from "sonner"

import type { ActionResult } from "@/server/errors"

/** Zod messages in our schemas are keys under "validation"; translate them for display. */
export function useValidationMessage() {
  const t = useTranslations("validation")
  return (key: string | undefined) =>
    key ? (t.has(key as never) ? t(key as never) : key) : undefined
}

/** Show a failed action: field errors go on the fields, everything else in a toast. */
export function useActionErrorHandler() {
  const t = useTranslations("errors")
  return function handle<T extends FieldValues>(
    result: Extract<ActionResult<unknown>, { ok: false }>,
    setError?: UseFormSetError<T>,
  ) {
    if (result.fieldErrors && setError) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.[0]) setError(field as Path<T>, { message: messages[0] })
      }
    }
    if (result.code === "internal") {
      toast.error(t("internal", { requestId: result.requestId ?? "-" }))
      return
    }
    // A specific message ("lastOwner") when there is one, else the generic one for the code.
    const key = (t.has(result.message as never) ? result.message : result.code) as "forbidden"
    toast.error(t(key))
  }
}

/**
 * Second argument to form.handleSubmit: a failed validation is never silent.
 * The fields show their own errors; this toast covers errors on fields without
 * visible inputs (and in development, logs which field failed).
 */
export function useInvalidHandler() {
  const t = useTranslations("errors")
  return (errors: FieldErrors) => {
    // Development aid only; skipped under browser automation (e2e tests submit
    // invalid forms on purpose and would flood the terminal).
    if (process.env.NODE_ENV !== "production" && !navigator.webdriver) {
      console.warn("Form validation failed:", Object.keys(errors), errors)
    }
    toast.error(t("validation"))
  }
}
