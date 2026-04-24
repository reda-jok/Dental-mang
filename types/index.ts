// ─── PATIENTS ───────────────────────────────────────────────────────────────
export interface Patient {
  id: number
  patientId: string
  firstName: string
  lastName: string
  name: string
  email?: string
  phone?: string
  dateOfBirth?: string
  address?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  medicalHistory?: string
  allergies?: string
  status: string
  balance: string | number
  lastVisit?: string
  nextAppointment?: string
  createdAt: string
}

// ─── APPOINTMENTS ───────────────────────────────────────────────────────────
export interface Appointment {
  id: number
  appointmentId: string
  patientId?: number | null
  patientName: string
  /** Alias used by components */
  patient?: string | null
  doctorId?: number | null
  doctorName?: string | null
  /** Alias used by components */
  dentist?: string | null
  date: string
  time?: string | null
  duration: number
  room?: string | null
  procedureName?: string | null
  /** Alias used by components */
  procedure?: string | null
  status: "pending" | "in-progress" | "completed" | "cancelled"
  priority: "normal" | "urgent"
  notes?: string | null
  createdAt: string
  patientRelation?: Patient
  doctor?: Employee
}

// ─── PROCEDURE TYPES ────────────────────────────────────────────────────────
export interface ProcedureType {
  id: number
  code: string
  name: string
  category?: string | null
  basePrice: number
  duration: number
  requiresAnesthesia: boolean
  description?: string | null
  createdAt: string
}

// ─── BILLING ────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  id: number
  invoiceId: number
  procedureId: number
  description: string
  amount: number
}

export interface Payment {
  id: number
  invoiceId: number
  amount: number
  method: "cash" | "card"
  paidAt: string
}

export interface Invoice {
  id: number
  patientId: number
  totalAmount: number
  paidAmount: number
  status: "unpaid" | "partial" | "paid"
  createdAt: string
  patient?: Patient
  items?: InvoiceItem[]
  payments?: Payment[]
}

// ─── HR ─────────────────────────────────────────────────────────────────────
export interface Employee {
  id: number
  fullName: string
  phone?: string | null
  role: "doctor" | "nurse" | "receptionist" | "admin"
  salary: number
  joinDate: string
  isActive: boolean
}

// ─── INVENTORY ──────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: number
  name: string
  category?: string | null
  unit?: string | null
  currentStock: number
  minStock: number
  createdAt: string
}

// ─── API RESPONSES ──────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  error?: string
  data?: T
}
