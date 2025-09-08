"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Filter, Eye, Edit, Phone, Mail, RefreshCw } from "lucide-react"

interface Patient {
  id: number
  patientId: string
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  status: string
  balance: string
  lastVisit: string
  nextAppointment: string
  avatar: string
}

export function PatientList() {
  const [searchTerm, setSearchTerm] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const response = await fetch("./api/patients")
      const data = await response.json()

      if (data.success) {
        setPatients(data.patients)
        setError("")
      } else {
        setError(data.error || "Failed to fetch patients")
      }
    } catch (err) {
      setError("Failed to connect to database")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [])

  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.includes(searchTerm) ||
      patient.patientId.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading patients...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchPatients}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Patient Management</CardTitle>
            <Button onClick={fetchPatients} variant="outline" size="sm" className="gap-2 bg-transparent">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, email, phone, or patient ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patient Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Patients ({filteredPatients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPatients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No patients found</p>
              <p className="text-sm text-gray-400">
                {patients.length === 0 ? "Add your first patient to get started" : "Try adjusting your search terms"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Next Appointment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={patient.avatar || "/placeholder.svg"} />
                          <AvatarFallback>
                            {patient.firstName[0]}
                            {patient.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-sm text-gray-600">ID: {patient.patientId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3 h-3" />
                          {patient.email || "No email"}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{patient.lastVisit}</TableCell>
                    <TableCell>{patient.nextAppointment}</TableCell>
                    <TableCell>
                      <Badge variant={patient.status === "Active" ? "default" : "secondary"}>{patient.status}</Badge>
                    </TableCell>
                    <TableCell className={patient.balance !== "$0.00" ? "text-red-600 font-medium" : ""}>
                      {patient.balance}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
