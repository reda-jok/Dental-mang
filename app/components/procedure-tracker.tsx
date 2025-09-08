"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, FileText, Calendar, DollarSign } from "lucide-react"
import { AddProcedureModal } from "./add-procedure-modal"

export function ProcedureTracker() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddProcedure, setShowAddProcedure] = useState(false)

  const procedureTypes = [
    {
      id: "PT001",
      code: "D1110",
      name: "Prophylaxis - Adult",
      category: "Preventive",
      basePrice: 150.0,
      duration: 60,
      requiresAnesthesia: false,
      description: "Adult prophylaxis (cleaning)",
      createdAt: "2024-01-01",
    },
    {
      id: "PT002",
      code: "D2740",
      name: "Crown - Porcelain/Ceramic",
      category: "Restorative",
      basePrice: 1200.0,
      duration: 120,
      requiresAnesthesia: true,
      description: "Crown - porcelain/ceramic substrate",
      createdAt: "2024-01-01",
    },
    {
      id: "PT003",
      code: "D3310",
      name: "Endodontic Therapy - Anterior",
      category: "Endodontic",
      basePrice: 800.0,
      duration: 90,
      requiresAnesthesia: true,
      description: "Endodontic therapy, anterior tooth",
      createdAt: "2024-01-01",
    },
    {
      id: "PT004",
      code: "D7140",
      name: "Extraction - Erupted Tooth",
      category: "Oral Surgery",
      basePrice: 300.0,
      duration: 45,
      requiresAnesthesia: true,
      description: "Extraction, erupted tooth or exposed root",
      createdAt: "2024-01-01",
    },
    {
      id: "PT005",
      code: "D9972",
      name: "External Bleaching - Per Arch",
      category: "Cosmetic",
      basePrice: 400.0,
      duration: 90,
      requiresAnesthesia: false,
      description: "External bleaching - per arch",
      createdAt: "2024-01-01",
    },
  ]

  const filteredProcedures = procedureTypes.filter((procedure) => {
    const matchesSearch =
      procedure.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      procedure.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      procedure.category.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Procedures</p>
                <p className="text-2xl font-bold">156</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold">23</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold">$24,580</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Procedure Type Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search procedures, patients, or procedure IDs..."
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
        {/* Procedure History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Procedures ({filteredProcedures.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Procedure Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Base Cost</TableHead>
                  <TableHead>Anesthesia</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcedures.map((procedure) => (
                  <TableRow key={procedure.id}>
                    <TableCell className="font-medium">{procedure.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{procedure.name}</p>
                        <p className="text-sm text-gray-600">{procedure.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{procedure.category}</Badge>
                    </TableCell>
                    <TableCell>{procedure.duration} min</TableCell>
                    <TableCell className="font-medium">${procedure.basePrice.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={procedure.requiresAnesthesia ? "destructive" : "secondary"}>
                        {procedure.requiresAnesthesia ? "Required" : "Not Required"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Procedure Types */}
        <Card>
          <CardHeader>
            <CardTitle>Procedure Types & Pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {procedureTypes.map((type, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{type.name}</p>
                    <p className="text-xs text-gray-600">{type.code}</p>
                  </div>
                  <p className="font-medium">${type.basePrice}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Procedure Modal */}
      <AddProcedureModal open={showAddProcedure} onOpenChange={setShowAddProcedure} />
    </div>
  )
}
