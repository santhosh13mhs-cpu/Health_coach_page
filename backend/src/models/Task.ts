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
  status?: 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED' // Auto-calculated, optional in DB
  created_at: string
  updated_at: string
  completed_at?: string | null
  assigned_by?: number | null
  documents?: any[]
  report_data?: any
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  coach_id?: number | null
  start_date: string
  end_date: string
  deadline: string
  allow_document_upload?: number
  report_type?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  start_date?: string
  end_date?: string
  deadline?: string
  allow_document_upload?: number
  report_type?: string | null
}

export interface UpdateTaskStatusInput {
  status: 'completed' | 'incomplete'
}

export interface TaskStats {
  total: number
  completed: number
  incomplete: number
}
