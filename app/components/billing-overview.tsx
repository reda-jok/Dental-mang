"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, DollarSign, CreditCard, AlertCircle, CheckCircle, Clock, Send } from "lucide-react"

export function BillingOverview() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const invoices = [
    {
      id: "INV-001",
      date: "2024-01-18",
      patient: "Alice Brown",
      procedure: "Crown Placement",
      amount: "$1,200.00",
      insurance: "$800.00",
      patientDue: "$400.00",
      status: "paid",
      dueDate: "2024-02-18",
    },
    {
      id: "INV-002",
      date: "2024-01-17",
      patient: "Robert Wilson",
      procedure: "Teeth Whitening",
      amount: "$400.00",
      insurance: "$0.00",
      patientDue: "$400.00",
      status: "pending",
      dueDate: "2024-02-17",
    },
    {
      id: "INV-003",
      date: "2024-01-16",
      patient: "Lisa Garcia",
      procedure: "Tooth Extraction",
      amount: "$300.00",
      insurance: "$200.00",
      patientDue: "$100.00",
      status: "overdue",
      dueDate: "2024-01-16",
    },
    {
      id: "INV-004",
      date: "2024-01-15",
      patient: "David Lee",
      procedure: "Routine Cleaning",
      amount: "$150.00",
      insurance: "$150.00",
      patientDue: "$0.00",
      status: "paid",
      dueDate: "2024-02-15",
    },
    {
      id: "INV-005",
      date: "2024-01-15",
      patient: "Mike Chen",
      procedure: "Root Canal Treatment",
      amount: "$800.00",
      insurance: "$600.00",
      patientDue: "$200.00",
      status: "pending",
      dueDate: "2024-02-15",
    },
  ]

  const paymentMethods = [
    { name: "Cash", count: 45, percentage: 30 },
    { name: "Credit Card", count: 78, percentage: 52 },
    { name: "Insurance", count: 23, percentage: 15 },
    { name: "Payment Plan", count: 4, percentage: 3 },
  ]

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.procedure.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalRevenue = invoices.reduce(
    (sum, inv) => sum + Number.parseFloat(inv.amount.replace("$", "").replace(",", "")),
    0,
  )
  const totalPending = invoices
    .filter((inv) => inv.status === "pending")
    .reduce((sum, inv) => sum + Number.parseFloat(inv.patientDue.replace("$", "").replace(",", "")), 0)
  const totalOverdue = invoices
    .filter((inv) => inv.status === "overdue")
    .reduce((sum, inv) => sum + Number.parseFloat(inv.patientDue.replace("$", "").replace(",", "")), 0)

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">${totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold">${totalOverdue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Collection Rate</p>
                <p className="text-2xl font-bold">94%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search invoices, patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gap-2">
              <Send className="w-4 h-4" />
              Send Statements
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Invoices ({filteredInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Patient Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.id}</p>
                        <p className="text-sm text-gray-600">{invoice.date}</p>
                      </div>
                    </TableCell>
                    <TableCell>{invoice.patient}</TableCell>
                    <TableCell>{invoice.procedure}</TableCell>
                    <TableCell className="font-medium">{invoice.amount}</TableCell>
                    <TableCell className={invoice.patientDue !== "$0.00" ? "font-medium" : "text-gray-500"}>
                      {invoice.patientDue}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "default"
                            : invoice.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                        {invoice.status !== "paid" && (
                          <Button variant="ghost" size="sm">
                            Pay
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentMethods.map((method, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{method.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{method.count}</p>
                      <p className="text-sm text-gray-600">{method.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full justify-start gap-2">
                  <Send className="w-4 h-4" />
                  Send Payment Reminders
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                  <DollarSign className="w-4 h-4" />
                  Process Insurance Claims
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                  <AlertCircle className="w-4 h-4" />
                  Review Overdue Accounts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
