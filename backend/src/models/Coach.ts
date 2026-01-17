export interface Coach {
  id: number
  name: string
  email: string
  created_at: string
}

export interface CreateCoachInput {
  name: string
  email: string
}

export interface UpdateCoachInput {
  name?: string
  email?: string
}
