export interface Lead {
  id: number
  name: string
  phone_number: string
  email: string
  assigned_coach_id: number | null
  created_at: string
  updated_at: string
}

export interface CreateLeadInput {
  name: string
  phone_number: string
  email: string
  assigned_coach_id?: number | null
}

export interface AssignLeadInput {
  coach_id: number
}
