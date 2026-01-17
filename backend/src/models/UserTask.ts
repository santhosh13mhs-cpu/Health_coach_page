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
}

export interface CreateUserTaskInput {
  user_id: number
  task_id: number
}

export interface BulkAssignTaskInput {
  task_id: number
  user_ids: number[]
}

export interface UserTaskWithDetails extends UserTask {
  task_title: string
  task_description: string | null
  task_start_date: string
  task_end_date: string
  task_deadline: string
  task_status?: 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED'
  assigned_by_name?: string
  coach_name?: string | null
  user_name?: string
  user_email?: string
}

export interface UpdateUserTaskStatusInput {
  status: 'COMPLETED' | 'INCOMPLETE'
  remarks?: string | null
  done_date?: string | null
}
