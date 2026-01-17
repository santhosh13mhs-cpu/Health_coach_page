export interface TaskDocument {
  id: number
  task_id: number
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: number | null
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
}

export interface CreateReportDataInput {
  task_id: number
  document_id?: number | null
  report_type?: 'SUGAR_REPORT' | 'OTHER'
  patient_name?: string | null
  age?: string | null
  gender?: string | null
  lab_name?: string | null
  doctor_name?: string | null
  blood_sugar_fasting?: string | null
  blood_sugar_pp?: string | null
  hba1c_value?: string | null
  extracted_data?: string | null
}

export interface UpdateReportDataInput {
  patient_name?: string | null
  age?: string | null
  gender?: string | null
  lab_name?: string | null
  doctor_name?: string | null
  blood_sugar_fasting?: string | null
  blood_sugar_pp?: string | null
  hba1c_value?: string | null
  extracted_data?: string | null
}
