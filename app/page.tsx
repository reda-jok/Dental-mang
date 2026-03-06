"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, FileText, DollarSign, Search, Plus, Menu } from "lucide-react"
import { PatientList } from "./components/patient-list"
import { AppointmentScheduler } from "./components/appointment-scheduler"
import { ProcedureTracker } from "./components/procedure-tracker"
import { BillingOverview } from "./components/billing-overview"
import { AddPatientModal } from "./components/add-patient-modal"
import { AddAppointmentModal } from "./components/add-appointment-modal"
import { CalendarSection } from "./components/calendar-section"
import { AddProcedureModal } from "./components/add-procedure-modal"

export default function DentalManagement() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [showAddAppointment, setShowAddAppointment] = useState(false)
  const [showAddProcedure, setShowAddProcedure] = useState(false)
  const [refreshPatients, setRefreshPatients] = useState(0)

// Define Patient type if not imported
type Patient = {
  id: string;
  name: string;
  age: number;
  // Add other relevant fields as needed
};

// Define Appointment type
type Appointment = {
  id: string;
  patientId: string;
  date: string;
  time: string;
  // Add other relevant fields as needed
};

const [patients, setPatients] = useState<Patient[]>([]);
const [appointments, setAppointments] = useState<Appointment[]>([]);
const [procedures, setProcedures] = useState<any[]>([]);
const [billing, setBilling] = useState<any>({});

useEffect(() => {
  const fetchData = async () => {
    try {
      const patientsRes = await fetch("/api/patients");
      const patientsData = await patientsRes.json();
      if (patientsData.success) setPatients(patientsData.patients);

      const appointmentsRes = await fetch("/api/appointments");
      const appointmentsData = await appointmentsRes.json();
      if (appointmentsData.success) setAppointments(appointmentsData.appointments);

      // const proceduresRes = await fetch("/api/procedures");
      // const proceduresData = await proceduresRes.json();
      // if (proceduresData.success) setProcedures(proceduresData.procedures);

      // const billingRes = await fetch("/api/billing");
      // const billingData = await billingRes.json();
      // if (billingData.success) setBilling(billingData);
    } catch (err) {
      console.error(err);
    }
  };

  fetchData();
}, [refreshPatients, showAddAppointment, showAddProcedure]);

  const stats = [
  { title: "Total Patients", value: patients.length.toString(), icon: Users },
  { title: "Today's Appointments", value: appointments.filter(a => a.date === new Date().toISOString().slice(0,10)).length.toString(), icon: Calendar },
  { title: "Procedures This Month", value: appointments.length.toString(), icon: FileText },
  { title: "Monthly Revenue", value: `$${billing.monthlyRevenue || 0}`, icon: DollarSign },
];


  const navigation = [
    { name: "Dashboard", id: "dashboard", icon: Menu },
    { name: "Patients", id: "patients", icon: Users },
    { name: "Appointments", id: "appointments", icon: Calendar },
    { name: "Procedures", id: "procedures", icon: FileText },
    { name: "Billing", id: "billing", icon: DollarSign },
  ]

  const handlePatientAdded = () => {
    setRefreshPatients((prev) => prev + 1)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${sidebarOpen ? "w-64" : "w-16"} flex flex-col`}>
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && <h1 className="font-bold text-lg">DentalCare Pro</h1>}
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${sidebarOpen ? "gap-3 px-3" : "justify-center px-2"} py-2 rounded-lg transition-colors ${
                  activeTab === item.id ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`w-full ${sidebarOpen ? "justify-start" : "justify-center"}`}
          >
            <Menu className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 capitalize">{activeTab}</h2>
              <p className="text-gray-600">Manage your dental practice efficiently</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search patients, appointments..." className="pl-10 w-80" />
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

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                      <stat.icon className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {stat.change} from last month
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Calendar Section */}
              <CalendarSection />

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Procedures</CardTitle>
                    <CardDescription>Latest completed procedures</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { patient: "Alice Brown", procedure: "Crown Placement", date: "Today", amount: "$1,200" },
                        { patient: "Robert Wilson", procedure: "Teeth Whitening", date: "Yesterday", amount: "$400" },
                        { patient: "Lisa Garcia", procedure: "Tooth Extraction", date: "2 days ago", amount: "$300" },
                        { patient: "David Lee", procedure: "Routine Cleaning", date: "3 days ago", amount: "$150" },
                      ].map((proc, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{proc.patient}</p>
                            <p className="text-sm text-gray-600">{proc.procedure}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{proc.amount}</p>
                            <p className="text-sm text-gray-600">{proc.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Stats</CardTitle>
                    <CardDescription>Practice overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">Patients Seen Today</span>
                        <span className="font-bold">12</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">Appointments Remaining</span>
                        <span className="font-bold">6</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">Revenue Today</span>
                        <span className="font-bold">$2,850</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium">No-Shows</span>
                        <span className="font-bold text-red-600">2</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "patients" && <PatientList key={refreshPatients} />}
          {activeTab === "appointments" && <AppointmentScheduler />}
          {activeTab === "procedures" && <ProcedureTracker />}
          {activeTab === "billing" && <BillingOverview />}
        </main>
      </div>

      {/* Modals */}
      <AddPatientModal open={showAddPatient} onOpenChange={setShowAddPatient} onPatientAdded={handlePatientAdded} />
      <AddAppointmentModal open={showAddAppointment} onOpenChange={setShowAddAppointment} />
      <AddProcedureModal open={showAddProcedure} onOpenChange={setShowAddProcedure} />
    </div>
  )
}
