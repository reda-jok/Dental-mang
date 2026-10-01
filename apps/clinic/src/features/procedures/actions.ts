"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { defineAction } from "@/server/action"

import {
  archiveProcedureSchema,
  categorySchema,
  createProcedureSchema,
  updateProcedureSchema,
} from "./schemas"
import {
  archiveProcedure,
  createCategory,
  createProcedure,
  loadStarterCatalog,
  updateProcedure,
} from "./service"

const refresh = () => revalidatePath("/settings/procedures")

export const createCategoryAction = defineAction({
  schema: categorySchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    const category = await createCategory(user, input)
    refresh()
    return category
  },
})

export const createProcedureAction = defineAction({
  schema: createProcedureSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    const procedure = await createProcedure(user, input)
    refresh()
    return procedure
  },
})

export const updateProcedureAction = defineAction({
  schema: updateProcedureSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await updateProcedure(user, input)
    refresh()
    return null
  },
})

export const archiveProcedureAction = defineAction({
  schema: archiveProcedureSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await archiveProcedure(user, input.id)
    refresh()
    return null
  },
})

export const loadStarterCatalogAction = defineAction({
  schema: z.strictObject({}),
  permission: "settings:write",
  handler: async (_input, { user }) => {
    await loadStarterCatalog(user)
    refresh()
    return null
  },
})
