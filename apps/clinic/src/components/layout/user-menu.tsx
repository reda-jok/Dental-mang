"use client"

import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import type { RoleName } from "@/lib/permissions"
import { THEME_COOKIE } from "@/lib/theme"

export function UserMenu({ user }: { user: { name: string; role: RoleName } }) {
  const t = useTranslations()
  const router = useRouter()

  async function logout() {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8">
                <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {t(`roles.${user.role}`)}
                </span>
              </div>
              <ChevronsUpDownIcon className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="min-w-56">
            <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeItem />
            <DropdownMenuItem onSelect={logout}>
              <LogOutIcon />
              {t("auth.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/**
 * Switches light/dark on this device. The class changes at once; the cookie makes the server
 * render the same theme from the next request on (the menu content only renders in the browser).
 */
function ThemeItem() {
  const t = useTranslations("nav")
  const router = useRouter()
  const dark = document.documentElement.classList.contains("dark")

  function toggle() {
    document.documentElement.classList.toggle("dark", !dark)
    document.cookie = `${THEME_COOKIE}=${dark ? "light" : "dark"}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  return (
    <DropdownMenuItem onSelect={toggle}>
      {dark ? <SunIcon /> : <MoonIcon />}
      {t(dark ? "lightMode" : "darkMode")}
    </DropdownMenuItem>
  )
}
