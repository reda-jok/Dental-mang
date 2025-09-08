import { NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// GET all procedure types
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        code,
        name,
        category,
        base_price,
        duration_minutes,
        requires_anesthesia,
        description,
        created_at
      FROM procedure_types 
      ORDER BY category, name
    `)

    const procedureTypes = result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      basePrice: Number.parseFloat(row.base_price),
      duration: row.duration_minutes,
      requiresAnesthesia: row.requires_anesthesia,
      description: row.description,
      createdAt: row.created_at,
    }))

    return NextResponse.json({ success: true, procedureTypes })
  } catch (error) {
    console.error("Error fetching procedure types:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST new procedure type
export async function POST(request: Request) {
  try {
    const data = await request.json()

    const result = await pool.query(
      `
      INSERT INTO procedure_types (
        code, name, category, base_price, duration_minutes, 
        requires_anesthesia, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        data.code.toUpperCase(),
        data.name,
        data.category,
        Number.parseFloat(data.cost),
        Number.parseInt(data.duration),
        data.requiresAnesthesia === "true",
        data.description || null,
      ],
    )

    return NextResponse.json({
      success: true,
      procedureType: result.rows[0],
      message: `Procedure type "${data.name}" added successfully!`,
    })
  } catch (error) {
    console.error("Error creating procedure type:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
