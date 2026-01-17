export interface Lead {
  id: number
  name: string
  phone_number: string
  email: string
  assigned_coach_id: number | null
  coach_name?: string
  coach_email?: string
  created_at: string
  updated_at: string
}

export interface Coach {
  id: number
  name: string
  email: string
  created_at: string
}

export interface Task {
  id: number
  title: string
  description: string | null
  coach_id: number | null
  start_date: string
  end_date: string
  deadline: string
  allow_document_upload?: number
  report_type?: string | null
  // Note: legacy task status uses 'completed'/'incomplete' (tasks table), while UI uses calculated statuses.
  status?: 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'completed' | 'incomplete' | 'INCOMPLETE'
  created_at: string
  updated_at: string
  completed_at?: string | null
  assigned_by?: number | null
}

export interface TaskStats {
  total: number
  completed: number
  incomplete: number
}

export interface UserTask {
  id: number
  user_id: number
  task_id: number
  status: 'COMPLETED' | 'INCOMPLETE'
  completed_at: string | null
  remarks: string | null
  done_date: string | null
  created_at: string
  updated_at: string
  // Joined task details
  task_title: string
  task_description: string | null
  task_start_date: string
  task_end_date: string
  task_deadline: string
  task_status?: 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED' | 'OVERDUE'
  coach_name?: string | null
  assigned_by_name?: string | null
  user_name?: string
  user_email?: string
}

export interface TaskDocument {
  id: number
  task_id: number
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: number | null
  uploaded_by_name?: string
  created_at: string
  updated_at: string
}

export interface ReportData {
  id: number
  task_id: number
  document_id: number | null
  report_type: 'SUGAR_REPORT' | 'OTHER'
  patient_name: string | null
  age: string | null
  gender: string | null
  lab_name: string | null
  doctor_name: string | null
  blood_sugar_fasting: string | null
  blood_sugar_pp: string | null
  hba1c_value: string | null
  extracted_data: string | null
  created_at: string
  updated_at: string
  file_name?: string
  file_path?: string
  file_type?: string
}
