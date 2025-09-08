import { NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// GET all patients
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        patient_id,
        first_name,
        last_name,
        email,
        phone,
        status,
        balance,
        last_visit,
        next_appointment,
        created_at
      FROM patients 
      ORDER BY created_at DESC
    `)

    const patients = result.rows.map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      name: `${row.first_name} ${row.last_name}`,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      balance: `$${Number.parseFloat(row.balance || 0).toFixed(2)}`,
      lastVisit: row.last_visit ? new Date(row.last_visit).toLocaleDateString() : "Never",
      nextAppointment: row.next_appointment ? new Date(row.next_appointment).toLocaleDateString() : "Not scheduled",
      avatar: "/placeholder.svg?height=40&width=40",
    }))

    return NextResponse.json({ success: true, patients })
  } catch (error) {
    console.error("Error fetching patients:", error)
    const errorMessage = typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : String(error)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

// POST new patient
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Generate unique patient ID
    const patientIdResult = await pool.query("SELECT COUNT(*) FROM patients")
    const patientCount = Number.parseInt(patientIdResult.rows[0].count)
    const patientId = `P${String(patientCount + 1).padStart(3, "0")}`

    const result = await pool.query(
      `
      INSERT INTO patients (
        patient_id, first_name, last_name, email, phone, 
        date_of_birth, address, city, state, zip_code,
        insurance_provider, emergency_contact_name, emergency_contact_phone,
        medical_history, allergies, status, balance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `,
      [
        patientId,
        data.firstName,
        data.lastName,
        data.email,
        data.phone,
        data.dateOfBirth || null,
        data.address || null,
        data.city || null,
        data.state || null,
        data.zipCode || null,
        data.insurance || null,
        data.emergencyContact || null,
        data.emergencyPhone || null,
        data.medicalHistory || null,
        data.allergies || null,
        "Active",
        0.0,
      ],
    )

    return NextResponse.json({
      success: true,
      patient: result.rows[0],
      message: `Patient ${data.firstName} ${data.lastName} added successfully!`,
    })
  } catch (error) {
    console.error("Error creating patient:", error)
    const errorMessage = typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : String(error)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
