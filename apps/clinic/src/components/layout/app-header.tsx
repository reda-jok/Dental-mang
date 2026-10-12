"use client"

import { ListPlusIcon, UserPlusIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { navGroups, type NavItem } from "./nav-items"

type QuickAction = "newPatient" | "newProcedure"

type Props = {
  /** Server-rendered search box (shown when the user may read patients). */
  search?: ReactNode
  actions: QuickAction[]
}

const allItems = navGroups.flatMap((g) => g.items)

/** The section the current page belongs to (longest matching nav href). */
function sectionFor(pathname: string): NavItem["key"] {
  const match = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return match?.key ?? "dashboard"
}

/** Top bar: the page title in Kufi, search and quick actions, a ledger rule underneath. */
export function AppHeader({ search, actions }: Props) {
  const t = useTranslations()
  const pathname = usePathname()
  const section = sectionFor(pathname)

  const quick: Record<
    QuickAction,
    { label: string; icon: ReactNode; href: Route; variant: "default" | "outline" }
  > = {
    newPatient: {
      label: t("header.newPatient"),
      icon: <UserPlusIcon />,
      href: "/patients/new",
      variant: "default",
    },
    newProcedure: {
      label: t("header.newProcedure"),
      icon: <ListPlusIcon />,
      href: "/settings/procedures?new=1" as Route,
      variant: "outline",
    },
  }

  return (
    <header className="tk-header sticky top-0 z-20 border-b bg-white px-4 py-3 md:px-6 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger label={t("nav.toggleSidebar")} />
          <div className="min-w-0">
            <h1 className="font-display truncate text-xl text-slate-900 md:text-2xl">
              {t(`nav.${section}`)}
            </h1>
            <p className="hidden text-sm text-slate-500 sm:block">{t("header.subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {search}
          {actions.map((key) => {
            const action = quick[key]
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant={action.variant}
                    className="gap-2"
                    aria-label={action.label}
                  >
                    <Link href={action.href}>
                      {action.icon}
                      <span className="hidden xl:inline">{action.label}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </header>
  )
}
