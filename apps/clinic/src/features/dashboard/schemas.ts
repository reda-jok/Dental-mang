import { z } from "zod"

import { ROLE_NAMES } from "@/lib/permissions"

import { WIDGET_KEYS } from "./widgets"

const widgets = z
  .array(z.strictObject({ key: z.enum(WIDGET_KEYS), hidden: z.boolean() }))
  .max(WIDGET_KEYS.length)
  .refine((list) => new Set(list.map((w) => w.key)).size === list.length, "invalid")

export const saveLayoutSchema = z.strictObject({ widgets })

/** The owner's default layout for a role (the owner's own layout isn't a default). */
export const saveRoleLayoutSchema = z.strictObject({
  role: z.enum(ROLE_NAMES.filter((r) => r !== "owner") as [string, ...string[]]),
  widgets,
})

/** What a stored layout must look like to be used; anything else is ignored. */
export const storedLayoutSchema = z.array(z.object({ key: z.string(), hidden: z.boolean() }))
