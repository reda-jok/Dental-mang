"use client"

import type { Route } from "next"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { hasPermission, type Permission, type RoleName } from "@/lib/permissions"

import { navGroups } from "./nav-items"
import { UserMenu } from "./user-menu"

type Props = {
  clinicName: string
  user: { name: string; role: RoleName; permissions: Permission[] }
}

export function AppSidebar({ clinicName, user }: Props) {
  const t = useTranslations()
  const pathname = usePathname()

  return (
    <Sidebar side="right" collapsible="icon" className="shadow-lg">
      <SidebarHeader className="border-b p-3">
        {/* The cyan Al-Tamkeen mark on an ink octagon, then the clinic's name */}
        <div className="flex items-center gap-3">
          <div className="tk-side-tile">
            <Logo variant="mark" tone="cyan" className="tk-side-logo" />
          </div>
          <span className="tk-side-name truncate text-lg group-data-[collapsible=icon]:hidden">
            {clinicName}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => {
          const items = group.items.filter(
            (item) => !item.permission || hasPermission(user, item.permission),
          )
          if (items.length === 0) return null
          return (
            <SidebarGroup key={group.key}>
              <SidebarGroupLabel>{t(`nav.${group.key}`)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      {item.ready ? (
                        <SidebarMenuButton
                          asChild
                          isActive={pathname.startsWith(item.href)}
                          tooltip={t(`nav.${item.key}`)}
                        >
                          <Link href={item.href as Route}>
                            <item.icon />
                            <span>{t(`nav.${item.key}`)}</span>
                          </Link>
                        </SidebarMenuButton>
                      ) : (
                        // Disabled buttons ignore the pointer; the wrapper keeps the tip working.
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="block rounded-md">
                              <SidebarMenuButton disabled aria-disabled>
                                <item.icon />
                                <span>{t(`nav.${item.key}`)}</span>
                                <Badge variant="secondary" className="ms-auto">
                                  {t("common.comingSoon")}
                                </Badge>
                              </SidebarMenuButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {t(`nav.${item.key}`)} · {t("common.comingSoonHint")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
