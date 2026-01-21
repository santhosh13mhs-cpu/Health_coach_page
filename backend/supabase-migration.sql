-- Supabase/PostgreSQL Migration Script
-- Run this in your Supabase SQL Editor to create all tables

-- Enable UUID extension (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Coaches table
CREATE TABLE IF NOT EXISTS coaches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  assigned_coach_id INTEGER REFERENCES coaches(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coach-User mapping
CREATE TABLE IF NOT EXISTS coach_users (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES coaches(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(coach_id, user_id)
);

-- User-Coach mapping (which coach is assigned to which user)
CREATE TABLE IF NOT EXISTS user_coach_mapping (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  coach_id INTEGER NOT NULL REFERENCES coaches(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  coach_id INTEGER REFERENCES coaches(id),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  deadline TIMESTAMP NOT NULL,
  allow_document_upload INTEGER NOT NULL DEFAULT 0,
  report_type TEXT,
  assigned_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Task assignments
CREATE TABLE IF NOT EXISTS user_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  status TEXT NOT NULL DEFAULT 'INCOMPLETE',
  completed_at TIMESTAMP,
  remarks TEXT,
  done_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, task_id)
);

-- OTP Verification table
CREATE TABLE IF NOT EXISTS otp_verifications (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used INTEGER NOT NULL DEFAULT 0,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Documents table
CREATE TABLE IF NOT EXISTS task_documents (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_task_id INTEGER REFERENCES user_tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report Data table
CREATE TABLE IF NOT EXISTS report_data (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_task_id INTEGER REFERENCES user_tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  document_id INTEGER REFERENCES task_documents(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL DEFAULT 'SUGAR_REPORT',
  patient_name TEXT,
  age TEXT,
  gender TEXT,
  lab_name TEXT,
  doctor_name TEXT,
  blood_sugar_fasting TEXT,
  blood_sugar_pp TEXT,
  hba1c_value TEXT,
  total_cholesterol TEXT,
  extracted_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_coach ON leads(assigned_coach_id);
CREATE INDEX IF NOT EXISTS idx_tasks_coach ON tasks(coach_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_coach_mapping_user ON user_coach_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coach_mapping_coach ON user_coach_mapping(coach_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task ON user_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_used ON otp_verifications(is_used);
CREATE INDEX IF NOT EXISTS idx_task_documents_task ON task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_user_task ON task_documents(user_task_id);
CREATE INDEX IF NOT EXISTS idx_report_data_task ON report_data(task_id);
CREATE INDEX IF NOT EXISTS idx_report_data_user_task ON report_data(user_task_id);
CREATE INDEX IF NOT EXISTS idx_report_data_document ON report_data(document_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tasks_updated_at BEFORE UPDATE ON user_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_documents_updated_at BEFORE UPDATE ON task_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_data_updated_at BEFORE UPDATE ON report_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
