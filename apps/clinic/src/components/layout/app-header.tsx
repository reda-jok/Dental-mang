"use client"

import { CalendarPlusIcon, ListPlusIcon, UserPlusIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { useBooking } from "@/features/appointments/components/booking-provider"

import { navGroups, type NavItem } from "./nav-items"

type QuickAction = "newPatient" | "newAppointment" | "newProcedure"

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

/** Top bar in the clinic's original style: page title, search and quick actions. */
export function AppHeader({ search, actions }: Props) {
  const t = useTranslations()
  const pathname = usePathname()
  const section = sectionFor(pathname)
  const { openBooking } = useBooking()

  const quick: Record<
    QuickAction,
    {
      label: string
      icon: ReactNode
      href?: Route
      onClick?: () => void
      variant: "default" | "outline"
    }
  > = {
    newPatient: {
      label: t("header.newPatient"),
      icon: <UserPlusIcon />,
      href: "/patients/new",
      variant: "default",
    },
    newAppointment: {
      label: t("header.newAppointment"),
      icon: <CalendarPlusIcon />,
      onClick: openBooking ? () => openBooking() : undefined,
      variant: "outline",
    },
    newProcedure: {
      label: t("header.newProcedure"),
      icon: <ListPlusIcon />,
      href: "/settings/procedures?new=1" as Route,
      variant: "outline",
    },
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-white px-4 py-3 shadow-sm md:px-6 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger label={t("nav.toggleSidebar")} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900 md:text-2xl">
              {t(`nav.${section}`)}
            </h1>
            <p className="hidden text-sm text-slate-500 sm:block">{t("header.subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {search}
          {actions.map((key) => {
            const action = quick[key]
            const content = (
              <>
                {action.icon}
                <span className="hidden xl:inline">{action.label}</span>
              </>
            )
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  {action.href ? (
                    <Button
                      asChild
                      variant={action.variant}
                      className="gap-2"
                      aria-label={action.label}
                    >
                      <Link href={action.href}>{content}</Link>
                    </Button>
                  ) : action.onClick ? (
                    <Button
                      variant={action.variant}
                      className="gap-2"
                      aria-label={action.label}
                      onClick={action.onClick}
                    >
                      {content}
                    </Button>
                  ) : (
                    // Not available: disabled, and the tip says so.
                    <span tabIndex={0} className="inline-flex">
                      <Button
                        variant={action.variant}
                        className="gap-2"
                        disabled
                        aria-label={action.label}
                      >
                        {content}
                      </Button>
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {action.href || action.onClick
                    ? action.label
                    : `${action.label} · ${t("common.comingSoonHint")}`}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </header>
  )
}
