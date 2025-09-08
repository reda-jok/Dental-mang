## Database Setup (One Time Only)

Run these commands in your PostgreSQL database:

\`\`\`sql
-- Connect to your database
\c dental_practice

-- 1. Create patients table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    insurance_provider VARCHAR(200),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_visit DATE,
    next_appointment DATE
);

-- 2. Create appointments table
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    appointment_id VARCHAR(20) UNIQUE NOT NULL,
    patient_id INTEGER REFERENCES patients(id),
    patient_name VARCHAR(200) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    dentist VARCHAR(100) NOT NULL,
    room VARCHAR(50),
    procedure_name VARCHAR(200) NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed',
    priority VARCHAR(20) DEFAULT 'normal',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create procedure types table
CREATE TABLE procedure_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    base_price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    requires_anesthesia BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create procedures table
CREATE TABLE procedures (
    id SERIAL PRIMARY KEY,
    procedure_id VARCHAR(20) UNIQUE NOT NULL,
    patient_id INTEGER REFERENCES patients(id),
    procedure_type_id INTEGER REFERENCES procedure_types(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    dentist VARCHAR(100) NOT NULL,
    room VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Scheduled',
    cost DECIMAL(10, 2) NOT NULL,
    insurance_covered DECIMAL(10, 2) DEFAULT 0.00,
    patient_portion DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'Pending',
    procedure_notes TEXT,
    tooth_numbers VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert sample procedure types
INSERT INTO procedure_types (code, name, category, base_price, duration_minutes, requires_anesthesia, description) VALUES
('D1110', 'Prophylaxis - Adult', 'Preventive', 150.00, 60, false, 'Adult prophylaxis (cleaning)'),
('D1120', 'Prophylaxis - Child', 'Preventive', 120.00, 45, false, 'Child prophylaxis (cleaning)'),
('D2391', 'Resin-based Composite - One Surface', 'Restorative', 200.00, 60, true, 'Resin-based composite - one surface, posterior'),
('D2740', 'Crown - Porcelain/Ceramic', 'Restorative', 1200.00, 120, true, 'Crown - porcelain/ceramic substrate'),
('D3310', 'Endodontic Therapy - Anterior', 'Endodontic', 800.00, 90, true, 'Endodontic therapy, anterior tooth'),
('D3320', 'Endodontic Therapy - Bicuspid', 'Endodontic', 900.00, 120, true, 'Endodontic therapy, bicuspid tooth'),
('D4341', 'Periodontal Scaling - Per Quadrant', 'Periodontal', 300.00, 60, true, 'Periodontal scaling and root planing'),
('D7140', 'Extraction - Erupted Tooth', 'Oral Surgery', 300.00, 45, true, 'Extraction, erupted tooth or exposed root'),
('D7210', 'Extraction - Impacted Tooth', 'Oral Surgery', 450.00, 60, true, 'Extraction, impacted tooth - soft tissue'),
('D9972', 'External Bleaching - Per Arch', 'Cosmetic', 400.00, 90, false, 'External bleaching - per arch');

-- 6. Insert sample patients
INSERT INTO patients (patient_id, first_name, last_name, email, phone, status, balance, last_visit, next_appointment) VALUES
('P001', 'Sarah', 'Johnson', 'sarah.johnson@email.com', '(555) 123-4567', 'Active', 0.00, '2024-01-15', '2024-02-15'),
('P002', 'Mike', 'Chen', 'mike.chen@email.com', '(555) 234-5678', 'Active', 150.00, '2024-01-10', '2024-01-22'),
('P003', 'Emma', 'Davis', 'emma.davis@email.com', '(555) 345-6789', 'Active', 0.00, '2023-12-20', '2024-02-01'),
('P004', 'John', 'Smith', 'john.smith@email.com', '(555) 456-7890', 'Active', 75.00, '2024-01-12', '2024-01-28'),
('P005', 'Alice', 'Brown', 'alice.brown@email.com', '(555) 567-8901', 'Active', 0.00, '2024-01-18', '2024-02-05');
\`\`\`

Now your app will have:
- ✅ Patients management
- ✅ Appointments scheduling  
- ✅ Procedure types management
- ✅ Procedure tracking
- ✅ All connected to real database
