import {
  BanknoteIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  StethoscopeIcon,
  UsersIcon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react"

import type { Permission } from "@/lib/permissions"
import type messages from "../../../messages/ar.json"

export type NavItem = {
  key: keyof (typeof messages)["nav"]
  href: string
  icon: LucideIcon
  /** Shown only to users with this permission. */
  permission?: Permission
  /** False until the module is built; rendered as "coming soon". */
  ready: boolean
}

export const navGroups: { key: NavItem["key"]; items: NavItem[] }[] = [
  {
    key: "main",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboardIcon, ready: true },
      {
        key: "patients",
        href: "/patients",
        icon: UsersIcon,
        permission: "patient:read",
        ready: true,
      },
      {
        key: "appointments",
        href: "/appointments",
        icon: CalendarDaysIcon,
        permission: "appointment:read",
        ready: true,
      },
      {
        key: "treatments",
        href: "/treatments",
        icon: StethoscopeIcon,
        permission: "clinical:read",
        ready: false,
      },
      {
        key: "billing",
        href: "/billing",
        icon: BanknoteIcon,
        permission: "billing:read",
        ready: false,
      },
      { key: "lab", href: "/lab", icon: FlaskConicalIcon, permission: "lab:read", ready: false },
    ],
  },
  {
    key: "management",
    items: [
      {
        key: "accounting",
        href: "/accounting",
        icon: BookOpenIcon,
        permission: "accounting:read",
        ready: false,
      },
      { key: "hr", href: "/hr", icon: UserCogIcon, permission: "hr:read", ready: false },
      {
        key: "inventory",
        href: "/inventory",
        icon: PackageIcon,
        permission: "inventory:read",
        ready: false,
      },
      {
        key: "settings",
        href: "/settings",
        icon: SettingsIcon,
        permission: "settings:read",
        ready: true,
      },
    ],
  },
]
