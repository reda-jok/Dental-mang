"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AddProcedureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProcedureCreated: (procedure: any) => void
}

export function AddProcedureModal({ open, onOpenChange, onProcedureCreated }: AddProcedureModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "",
    cost: "",
    duration: "60",
    description: "",
    requiresAnesthesia: "false",
  })

  const categories = [
    "Preventive",
    "Diagnostic",
    "Restorative",
    "Endodontic",
    "Periodontal",
    "Prosthodontic",
    "Oral Surgery",
    "Orthodontic",
    "Cosmetic",
    "Emergency",
  ]

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.name || !formData.code || !formData.category || !formData.cost) {
      alert("Please fill in all required fields")
      return
    }

    // Generate a unique procedure type ID
    const procedureTypeId = `PT${String(Date.now()).slice(-6)}`

    // Create the procedure type object
    const newProcedureType = {
      id: procedureTypeId,
      name: formData.name,
      code: formData.code.toUpperCase(),
      category: formData.category,
      basePrice: Number.parseFloat(formData.cost),
      durationMinutes: Number.parseInt(formData.duration),
      description: formData.description,
      requiresAnesthesia: formData.requiresAnesthesia === "true",
      createdAt: new Date().toISOString(),
    }
  try{
    const response = await fetch("/api/procedure-types", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newProcedureType),
    })
    const data = await response.json()

      if (data.success) {
        alert(data.message)
        onOpenChange(false)
        resetForm()
        if (onProcedureCreated) {
          onProcedureCreated(data.procedure)
        }
      } else {
        setError(data.error || "Failed to add procedure")
      }
    } catch (err) {
      setError("Failed to connect to database")
    } finally {
      setIsSubmitting(false)
    }
  }
    // In a real app, you would send this to your API
    // console.log("New procedure type created:", newProcedureType)

    // // Show success message
    // alert(
    //   `Procedure type "${formData.name}" has been added successfully!\nCode: ${formData.code}\nCost: $${formData.cost}\nDuration: ${formData.duration} minutes`,
    // )

    // Close modal and reset form
  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      category: "",
      cost: "",
      duration: "60",
      description: "",
      requiresAnesthesia: "false",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Procedure Type</DialogTitle>
          <DialogDescription>Define a new dental procedure with its standard cost and duration.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Procedure Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Routine Cleaning"
                  required
                />
              </div>
              <div>
                <Label htmlFor="code">Procedure Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., D1110"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cost">Base Cost (IQD) *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Select
                  value={formData.duration}
                  onValueChange={(value) => setFormData({ ...formData, duration: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                    <SelectItem value="150">150 minutes</SelectItem>
                    <SelectItem value="180">180 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="requiresAnesthesia">Requires Anesthesia</Label>
                <Select
                  value={formData.requiresAnesthesia}
                  onValueChange={(value) => setFormData({ ...formData, requiresAnesthesia: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the procedure..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Procedure Type</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
