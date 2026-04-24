"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  DollarSign,
  Menu,
  Search,
  Plus,
  Stethoscope,
} from "lucide-react"
import { AddPatientModal } from "@/app/components/add-patient-modal"
import { AddAppointmentModal } from "@/app/components/add-appointment-modal"
import { AddProcedureModal } from "@/app/components/add-procedure-modal"

const navigation = [
  { name: "Dashboard",    href: "/dashboard",    icon: LayoutDashboard },
  { name: "Patients",     href: "/patients",     icon: Users },
  { name: "Appointments", href: "/appointments", icon: Calendar },
  { name: "Procedures",   href: "/procedures",   icon: FileText },
  { name: "Billing",      href: "/billing",      icon: DollarSign },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [showAddAppointment, setShowAddAppointment] = useState(false)
  const [showAddProcedure, setShowAddProcedure] = useState(false)

  // Derive the active page title from the current path
  const activeNav = navigation.find((n) => pathname.startsWith(n.href))
  const pageTitle = activeNav?.name ?? "Dashboard"

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div
        className={`bg-white shadow-lg transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-16"
        } flex flex-col shrink-0`}
      >
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && (
              <h1 className="font-bold text-lg whitespace-nowrap">DentalCare Pro</h1>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center ${
                    sidebarOpen ? "gap-3 px-3" : "justify-center px-2"
                  } py-2 rounded-lg transition-colors text-sm font-medium ${
                    active
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {sidebarOpen && <span>{item.name}</span>}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen((v) => !v)}
            className={`w-full ${sidebarOpen ? "justify-start" : "justify-center"}`}
          >
            <Menu className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{pageTitle}</h2>
              <p className="text-gray-500 text-sm">Manage your dental practice efficiently</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search patients, appointments..."
                  className="pl-10 w-72"
                />
              </div>
              <Button onClick={() => setShowAddPatient(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Patient
              </Button>
              <Button onClick={() => setShowAddAppointment(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                New Appointment
              </Button>
              <Button onClick={() => setShowAddProcedure(true)} variant="outline" className="gap-2 bg-transparent">
                <Plus className="w-4 h-4" />
                Add Procedure Type
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AddPatientModal open={showAddPatient} onOpenChange={setShowAddPatient} onPatientAdded={() => {}} />
      <AddAppointmentModal open={showAddAppointment} onOpenChange={setShowAddAppointment} />
      <AddProcedureModal open={showAddProcedure} onOpenChange={setShowAddProcedure} />
    </div>
  )
}
