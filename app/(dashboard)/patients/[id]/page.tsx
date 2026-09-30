"use client"

import React, { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, FileImage, FileText, Activity, AlertCircle, Plus, CheckCircle2, ChevronLeft } from "lucide-react"

// Types for our clinical data
type ToothCondition = "Healthy" | "Caries" | "Filled" | "Extracted" | "Crown" | "Root Canal"
type ToothStatus = { id: number; condition: ToothCondition; notes?: string }

const MOCK_PATIENT = {
  id: "1",
  name: "Sarah Jenkins",
  age: 34,
  phone: "+1 234 567 8900",
  lastVisit: "2024-03-15",
  allergies: ["Penicillin"],
  medicalHistory: ["Asthma"],
}

export default function PatientClinicalPage() {
  const params = useParams()
  const router = useRouter()
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [teethStatuses, setTeethStatuses] = useState<ToothStatus[]>([
    { id: 4, condition: "Filled" },
    { id: 8, condition: "Caries" },
    { id: 14, condition: "Extracted" },
    { id: 30, condition: "Crown" },
  ])

  // Tooth rendering logic
  const upperTeeth = Array.from({ length: 16 }, (_, i) => i + 1)
  const lowerTeeth = Array.from({ length: 16 }, (_, i) => 32 - i)

  const getToothStatus = (id: number) => teethStatuses.find((t) => t.id === id) || { id, condition: "Healthy" }

  const getConditionColor = (condition: ToothCondition) => {
    switch (condition) {
      case "Healthy": return "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
      case "Caries": return "bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
      case "Filled": return "bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
      case "Extracted": return "bg-slate-200 border-slate-400 text-slate-500 opacity-50 hover:bg-slate-300 line-through"
      case "Crown": return "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
      case "Root Canal": return "bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200"
      default: return "bg-white border-slate-200"
    }
  }

  const handleToothClick = (id: number) => {
    setSelectedTooth(id)
  }

  const updateToothCondition = (condition: ToothCondition) => {
    if (!selectedTooth) return
    setTeethStatuses(prev => {
      const existing = prev.find(t => t.id === selectedTooth)
      if (existing) {
        return prev.map(t => t.id === selectedTooth ? { ...t, condition } : t)
      }
      return [...prev, { id: selectedTooth, condition }]
    })
  }

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 bg-slate-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {MOCK_PATIENT.name}
              <Badge variant="outline" className="ml-2 text-sm font-normal">ID: {params?.id || MOCK_PATIENT.id}</Badge>
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {MOCK_PATIENT.age} yrs</span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Last visit: {MOCK_PATIENT.lastVisit}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="bg-white hover:bg-slate-100 shadow-sm">
            <FileText className="mr-2 h-4 w-4" /> Patient History
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
            <Plus className="mr-2 h-4 w-4" /> Schedule Appointment
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {MOCK_PATIENT.allergies.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3 shadow-sm">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-800">Medical Alerts</h3>
            <p className="text-sm text-red-700 mt-1">
              Allergies: {MOCK_PATIENT.allergies.join(", ")} | History: {MOCK_PATIENT.medicalHistory.join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="clinical" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-white shadow-sm p-1 rounded-xl">
          <TabsTrigger value="clinical" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all">
            <Activity className="w-4 h-4 mr-2" /> Clinical Chart
          </TabsTrigger>
          <TabsTrigger value="xray" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all">
            <FileImage className="w-4 h-4 mr-2" /> X-Rays
          </TabsTrigger>
          <TabsTrigger value="treatment" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all">
            <CheckCircle2 className="w-4 h-4 mr-2" /> Treatment Plan
          </TabsTrigger>
        </TabsList>

        {/* CLINICAL CHART TAB */}
        <TabsContent value="clinical" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tooth Chart Component */}
            <Card className="lg:col-span-2 shadow-sm border-slate-200 rounded-2xl overflow-hidden">
              <CardHeader className="bg-white border-b border-slate-100 pb-4">
                <CardTitle className="text-xl text-slate-800 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-500" /> Interactive Odontogram
                </CardTitle>
                <CardDescription>Select a tooth to view details or add clinical findings.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 bg-slate-50/50">
                <div className="flex flex-col gap-12 items-center">
                  
                  {/* Upper Teeth */}
                  <div className="w-full">
                    <p className="text-center text-sm font-semibold text-slate-400 mb-4 tracking-widest uppercase">Maxillary (Upper)</p>
                    <div className="flex justify-center gap-1.5 flex-wrap">
                      {upperTeeth.map(id => {
                        const status = getToothStatus(id)
                        const isSelected = selectedTooth === id
                        return (
                          <button
                            key={id}
                            onClick={() => handleToothClick(id)}
                            className={`
                              relative flex flex-col items-center justify-center w-10 h-14 rounded-t-lg rounded-b-sm border-2 transition-all duration-200
                              ${getConditionColor(status.condition)}
                              ${isSelected ? 'ring-4 ring-blue-300 scale-110 z-10' : 'hover:-translate-y-1 hover:shadow-md'}
                            `}
                          >
                            <span className="text-xs font-bold absolute top-1 opacity-70">{id}</span>
                            {/* Simple visual representation of a tooth shape */}
                            <div className="w-full h-1/2 mt-auto border-t border-black/10 rounded-b-sm bg-white/40"></div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <Separator className="w-3/4 opacity-50" />

                  {/* Lower Teeth */}
                  <div className="w-full">
                    <div className="flex justify-center gap-1.5 flex-wrap">
                      {lowerTeeth.map(id => {
                        const status = getToothStatus(id)
                        const isSelected = selectedTooth === id
                        return (
                          <button
                            key={id}
                            onClick={() => handleToothClick(id)}
                            className={`
                              relative flex flex-col items-center justify-center w-10 h-14 rounded-b-lg rounded-t-sm border-2 transition-all duration-200
                              ${getConditionColor(status.condition)}
                              ${isSelected ? 'ring-4 ring-blue-300 scale-110 z-10' : 'hover:translate-y-1 hover:shadow-md'}
                            `}
                          >
                            <div className="w-full h-1/2 mb-auto border-b border-black/10 rounded-t-sm bg-white/40"></div>
                            <span className="text-xs font-bold absolute bottom-1 opacity-70">{id}</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-center text-sm font-semibold text-slate-400 mt-4 tracking-widest uppercase">Mandibular (Lower)</p>
                  </div>

                </div>

                {/* Legend */}
                <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-medium text-slate-600 bg-white p-3 rounded-lg border shadow-sm">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border border-slate-300"></div> Healthy</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div> Caries</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-400"></div> Filled</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-300"></div> Extracted</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Crown</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-400"></div> Root Canal</div>
                </div>
              </CardContent>
            </Card>

            {/* Tooth Details Panel */}
            <Card className="shadow-sm border-slate-200 rounded-2xl">
              <CardHeader className="bg-slate-900 text-white rounded-t-2xl pb-6">
                <CardTitle className="text-lg flex items-center justify-between">
                  Tooth Details
                  {selectedTooth && <Badge className="bg-blue-500 hover:bg-blue-600 text-lg px-3 py-1">#{selectedTooth}</Badge>}
                </CardTitle>
                {!selectedTooth && <CardDescription className="text-slate-400 mt-2">Select a tooth from the chart to view and edit details.</CardDescription>}
              </CardHeader>
              <CardContent className="p-6 -mt-4 bg-white rounded-2xl relative z-10 shadow-sm border-x border-b">
                {selectedTooth ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Current Status</h4>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`text-sm px-3 py-1 ${getConditionColor(getToothStatus(selectedTooth).condition)}`}>
                          {getToothStatus(selectedTooth).condition}
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Update Condition</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {(["Healthy", "Caries", "Filled", "Extracted", "Crown", "Root Canal"] as ToothCondition[]).map(cond => (
                          <Button 
                            key={cond} 
                            variant="outline" 
                            size="sm"
                            className={`justify-start ${getToothStatus(selectedTooth).condition === cond ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                            onClick={() => updateToothCondition(cond)}
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${getConditionColor(cond).split(' ')[0]}`}></div>
                            {cond}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">Add to Treatment Plan</Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                    <Activity className="w-12 h-12 mb-4 opacity-20" />
                    <p>No tooth selected</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* X-RAY TAB */}
        <TabsContent value="xray" className="mt-6 space-y-6">
          <Card className="shadow-sm border-slate-200 rounded-2xl overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-xl text-slate-800 flex items-center">
                  <FileImage className="w-5 h-5 mr-2 text-blue-500" /> Radiography & Imagery
                </CardTitle>
                <CardDescription>View and upload patient X-rays and scans.</CardDescription>
              </div>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white">
                <Plus className="w-4 h-4 mr-2" /> Upload Image
              </Button>
            </CardHeader>
            <CardContent className="p-6 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Mock X-Rays */}
                {[
                  { id: 1, date: "2024-03-15", type: "Panoramic", img: "https://images.unsplash.com/photo-1600170311833-c2cf5280ce49?q=80&w=600&auto=format&fit=crop" },
                  { id: 2, date: "2023-10-10", type: "Bitewing Left", img: "https://images.unsplash.com/photo-1590623253278-df1f8c853f2c?q=80&w=600&auto=format&fit=crop" },
                  { id: 3, date: "2023-10-10", type: "Bitewing Right", img: "https://images.unsplash.com/photo-1590623253278-df1f8c853f2c?q=80&w=600&auto=format&fit=crop" },
                ].map((xray) => (
                  <div key={xray.id} className="group relative rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all">
                    <div className="aspect-[4/3] bg-black relative overflow-hidden flex items-center justify-center">
                      <img src={xray.img} alt={xray.type} className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500 grayscale group-hover:grayscale-0" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <div className="absolute bottom-3 left-4 text-white">
                        <p className="font-semibold">{xray.type}</p>
                        <p className="text-xs text-white/80">{xray.date}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-white flex justify-between items-center">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">View Full</Button>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-600 hover:bg-red-50">Delete</Button>
                    </div>
                  </div>
                ))}
                
                {/* Empty Upload Slot */}
                <button className="flex flex-col items-center justify-center aspect-[4/3] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-blue-400 transition-all text-slate-500 hover:text-blue-600 group">
                  <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="font-medium">Drop new X-ray here</span>
                  <span className="text-xs text-slate-400 mt-1">PNG, JPG, DICOM</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TREATMENT PLAN TAB (Placeholder) */}
        <TabsContent value="treatment" className="mt-6">
          <Card className="shadow-sm border-slate-200 rounded-2xl">
            <CardHeader className="bg-white border-b border-slate-100 pb-4">
              <CardTitle className="text-xl text-slate-800 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-blue-500" /> Proposed Treatment Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center text-slate-500">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                  <Activity className="w-8 h-8 text-blue-400" />
                </div>
                <p>Select teeth from the clinical chart and add them to the treatment plan to generate a schedule and cost estimate.</p>
                <Button variant="outline" onClick={() => document.querySelector<HTMLButtonElement>('[value="clinical"]')?.click()}>
                  Go to Clinical Chart
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
