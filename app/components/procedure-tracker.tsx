"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, FileText, Calendar, DollarSign, RefreshCw } from "lucide-react"
import { AddProcedureModal } from "./add-procedure-modal"
import { useProcedureTypes } from "@/hooks/use-procedure-types"

export function ProcedureTracker() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddProcedure, setShowAddProcedure] = useState(false)
  const { procedureTypes, isLoading, error } = useProcedureTypes()

  const filtered = procedureTypes.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-500">Loading procedures…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-600">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Procedure Types</p>
                <p className="text-2xl font-bold">{procedureTypes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Require Anesthesia</p>
                <p className="text-2xl font-bold">
                  {procedureTypes.filter((p) => p.requiresAnesthesia).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Base Price</p>
                <p className="text-2xl font-bold">
                  $
                  {procedureTypes.length > 0
                    ? Math.round(
                        procedureTypes.reduce((s, p) => s + p.basePrice, 0) /
                          procedureTypes.length,
                      )
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Categories</p>
                <p className="text-2xl font-bold">
                  {new Set(procedureTypes.map((p) => p.category ?? "Other")).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Procedure Type Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search procedures by name, code, or category…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowAddProcedure(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Procedure Type
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All Procedure Types ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No procedure types found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Anesthesia</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.code}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-gray-500">{p.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.category ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>{p.duration} min</TableCell>
                      <TableCell className="font-medium">${p.basePrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={p.requiresAnesthesia ? "destructive" : "secondary"}>
                          {p.requiresAnesthesia ? "Required" : "Not Required"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            Delete
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

        {/* Pricing sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>Procedure Types & Pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {procedureTypes.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.code}</p>
                  </div>
                  <p className="font-medium">${p.basePrice}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AddProcedureModal open={showAddProcedure} onOpenChange={setShowAddProcedure} />
    </div>
  )
}
