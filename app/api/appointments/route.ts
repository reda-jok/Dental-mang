// import { NextResponse } from "next/server"
// import PG, { Pool } from "pg"
// import { off } from "process"
// import {v4 as uuidv4} from "uuid"

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// })

// // GET all appointments
// export async function GET(request: Request) {
//   try {
//     const { searchParams } = new URL(request.url)
//     const date = searchParams.get("date")
//     const month = searchParams.get("month")

//     let query = `
//       SELECT 
//         id,
//         appointment_id,
//         patient_id,
//         patient_name,
//         appointment_date,
//         appointment_time,
//         duration_minutes,
//         dentist,
//         room,
//         procedure_name,
//         status,
//         priority,
//         notes,
//         created_at
//       FROM appointments
//     `
//     const params: any[] = []

//     if (date) {
//       query += ` WHERE appointment_date = $1`
//       params.push(date)
//     } else if (month) {
//       query += ` WHERE DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', $1::date)`
//       params.push(month + "-01")
//     }

//     query += ` ORDER BY appointment_date, appointment_time`

//     const result = await pool.query(query, params)

//     // ✅ Separate rest-days from normal appointments
//     const appointments = result.rows
//       .filter((row) => row.status !== "rest-day")
//       .map((row) => ({
//         id: row.id,
//         appointmentId: row.appointment_id,
//         patientId: row.patient_id,
//         patient: row.patient_name,
//         date: row.appointment_date, 
//         time: row.appointment_time?.slice(0, 5),
//         duration: row.duration_minutes,
//         dentist: row.dentist,
//         room: row.room,
//         procedure: row.procedure_name,
//         status: row.status,
//         priority: row.priority,
//         notes: row.notes,
//         createdAt: row.created_at,
//       }))

//     const restDays = result.rows
//       .filter((row) => row.status === "rest-day")
//       .map((row) => row.appointment_date)

//     return NextResponse.json({ success: true, appointments, restDays })
//   } catch (error: any) {
//     console.error("Error fetching appointments:", error)
//     return NextResponse.json({ success: false, error: error.message }, { status: 500 })
//   }
// }


// // POST new appointment (normal + rest-day)

// export async function POST(request: Request) {
//   try {
//     const data = await request.json();

//     // Generate a new unique appointment_id
//     const lastIdResult = await pool.query(
//       `SELECT appointment_id FROM appointments WHERE appointment_id LIKE 'APT%' ORDER BY id DESC LIMIT 1`
//     );

//     const appointmentId = `APT${uuidv4().slice(0, 10)}`;

//     // Handle rest-day insertion
//     if (data.status === "rest-day") {
//       const result = await pool.query(
//         `
//         INSERT INTO appointments (
//           appointment_id, patient_name, appointment_date, appointment_time,
//           dentist, procedure_name, status
//         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
//         RETURNING *
//         `,
//         [
//           `REST-${appointmentId}`,
//           "Rest Day",
//           data.date,
//           "00:00",
//           "N/A",
//           "Rest Day",
//           "rest-day",
//         ]
//       );

//       return NextResponse.json({
//         success: true,
//         appointment: result.rows[0],
//         message: "Rest day added successfully!",
//       }, { status: 201 });
//     }

//     // Normal appointment
//     let patientId = null;
//     if (data.patient) {
//       const patientResult = await pool.query(
//         "SELECT id FROM patients WHERE CONCAT(first_name, ' ', last_name) = $1",
//         [data.patient]
//       );
//       if (patientResult.rows.length > 0) {
//         patientId = patientResult.rows[0].id;
//       }
//     }

//     const result = await pool.query(
//       `
//       INSERT INTO appointments (
//         appointment_id, patient_id, patient_name, appointment_date, appointment_time,
//         duration_minutes, dentist, room, procedure_name, status, priority, notes
//       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
//       RETURNING *
//       `,
//       [
//         appointmentId,
//         patientId,
//         data.patient,
//         data.date,
//         data.time,
//         Number.parseInt(data.duration) || 60,
//         data.dentist,
//         data.room || null,
//         data.procedure,
//         "pending",
//         data.priority || "normal",
//         data.notes || null,
//       ]
//     );

//     return NextResponse.json({
//       success: true,
//       appointment: result.rows[0],
//       message: "Appointment scheduled successfully!",
//     });
//   } catch (error: any) {
//     console.error("Error creating appointment:", error);
//     return NextResponse.json({ success: false, error: error.message }, { status: 500 });
//   }
// }

// // PATCH appointment status
// export async function PATCH(request: Request) {
//   try {
//     const { id, status } = await request.json()

//     if (!["pending", "in-progress", "completed", "rest-day"].includes(status)) {
//       return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 })
//     }

//     const result = await pool.query(
//       "UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *",
//       [status, id]
//     )

//     if (result.rowCount === 0) {
//       return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 })
//     }

//     return NextResponse.json({ success: true, appointment: result.rows[0] })
//   } catch (error: any) {
//     console.error("Error updating appointment status:", error)
//     return NextResponse.json({ success: false, error: error.message }, { status: 500 })
//   }
// }

// // DELETE rest-day
// export async function DELETE(req: Request) {
//   try {
//     const { appointmentId, date } = await req.json();

//     if (!appointmentId && !date) {
//       return NextResponse.json({ success: false, error: "appointmentId or date is required" }, { status: 400 });
//     }

//     let result;
//     if (appointmentId) {
//       // delete by appointmentId
//       result = await pool.query(
//         `DELETE FROM appointments WHERE appointment_id = $1`,
//         [appointmentId]
//       );
//     } else if (date) {
//       // delete rest-day appointments for that date
//       result = await pool.query(
//         `DELETE FROM appointments WHERE appointment_date = $1 AND status = 'rest-day'`,
//         [date]
//       );
//     } else {
//       return NextResponse.json({ success: false, error: "appointmentId or date is required" }, { status: 400 });
//     }

//     return NextResponse.json({ success: true, deletedCount: result.rowCount });
//   } catch (err: any) {
//     console.error("Error deleting rest-day:", err);
//     return NextResponse.json({ success: false, error: err.message }, { status: 500 });
//   }
// }

