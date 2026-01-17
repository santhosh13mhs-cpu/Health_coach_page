export interface User {
  id: number
  name: string
  email: string
  password?: string // Never return in responses
  role: 'ADMIN' | 'COACH' | 'USER'
  created_at: string
  updated_at: string
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role?: 'ADMIN' | 'COACH' | 'USER'
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthResponse {
  user: Omit<User, 'password'>
  token: string
}
