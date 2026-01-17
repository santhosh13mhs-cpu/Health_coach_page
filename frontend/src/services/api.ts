import axios from 'axios'

// Get API URL from environment variable or default to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors and API connectivity issues
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors (backend not available)
    if (!error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK')) {
      console.error('Backend API is not available. Please check your VITE_API_URL environment variable.')
      // Don't throw error on network issues during initial auth check
      if (error.config?.url && !error.config.url.includes('/auth/current-user')) {
        return Promise.reject(new Error('Unable to connect to the server. Please check your connection or contact support.'))
      }
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    // Handle 403 Forbidden errors - show more helpful message
    if (error.response?.status === 403) {
      console.error('403 Forbidden:', error.response?.data)
      // Don't redirect on 403, just show error
    }
    // Handle 404 errors - might be backend not deployed
    if (error.response?.status === 404 && error.config?.url?.includes('/api/')) {
      console.warn('API endpoint not found. Ensure backend is deployed and VITE_API_URL is configured correctly.')
    }
    return Promise.reject(error)
  }
)

// Leads API
export const leadsAPI = {
  getAll: (coachId?: number) => api.get('/leads', { params: { coach_id: coachId } }),
  getById: (id: number) => api.get(`/leads/${id}`),
  assign: (id: number, coachId: number | null) => 
    api.put(`/leads/${id}/assign`, { coach_id: coachId }),
  bulkAssign: (leadIds: number[], coachId: number | null) =>
    api.put('/leads/bulk-assign', { lead_ids: leadIds, coach_id: coachId }),
  delete: (id: number) => api.delete(`/leads/${id}`),
  bulkDelete: (leadIds: number[]) => api.post('/leads/bulk/delete', { lead_ids: leadIds }),
  upload: (file: File, coachId?: number | null) => {
    const formData = new FormData()
    formData.append('file', file)
    
    // Always append coach_id (even if empty string) so backend can parse it
    if (coachId !== undefined && coachId !== null && coachId > 0) {
      formData.append('coach_id', coachId.toString())
    } else {
      formData.append('coach_id', '')
    }
    
    // Get token manually to ensure it's included
    const token = localStorage.getItem('token')
    if (!token) {
      return Promise.reject(new Error('No authentication token found. Please log in again.'))
    }
    
    console.log('Uploading file:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      coachId: coachId,
      hasFile: file instanceof File
    })
    
    // Verify file is valid
    if (!(file instanceof File) || file.size === 0) {
      return Promise.reject(new Error('Invalid file. Please select a valid Excel file.'))
    }
    
    // Axios interceptor should add Authorization header, but ensure it's set
    // Don't set Content-Type - let browser set it automatically for multipart/form-data
    return api.post('/upload/leads', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - browser will set it with boundary
      },
      // Increase timeout for large files
      timeout: 60000,
      // Ensure FormData is sent correctly
      transformRequest: (data) => data, // Don't transform FormData
    })
  },
}

// Coaches API
export const coachesAPI = {
  getAll: () => api.get('/coaches'),
  getById: (id: number) => api.get(`/coaches/${id}`),
  create: (data: { name: string; email: string }) => api.post('/coaches', data),
  update: (id: number, data: { name?: string; email?: string }) =>
    api.put(`/coaches/${id}`, data),
  getLeads: (id: number) => api.get(`/coaches/${id}/leads`),
  getAllAnalytics: () => api.get('/coaches/analytics/all'),
}

// Tasks API
export const tasksAPI = {
  getAll: (coachId?: number) => api.get('/tasks', { params: { coach_id: coachId } }),
  getById: (id: number) => api.get(`/tasks/${id}`),
  create: (data: {
    title: string
    description?: string | null
    coach_id?: number | null
    start_date: string
    end_date: string
    deadline: string
    allow_document_upload?: number
    report_type?: string | null
  }) => api.post('/tasks', data),
  update: (
    id: number,
    data: { title?: string; description?: string | null; start_date?: string; end_date?: string; deadline?: string; allow_document_upload?: number; report_type?: string | null }
  ) => api.put(`/tasks/${id}`, data),
  updateStatus: (id: number, status: 'completed' | 'incomplete') =>
    api.patch(`/tasks/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/tasks/${id}`),
  getStats: (coachId: number) => api.get(`/tasks/stats/${coachId}`),
  getByDate: (coachId: number) => api.get(`/tasks/by-date/${coachId}`),
}

// Auth API
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  signup: (data: {
    name: string
    email: string
    password: string
    role?: 'USER' | 'COACH' | 'ADMIN'
  }) => api.post('/auth/signup', data),
  forgotPassword: (data: { email: string }) => api.post('/auth/forgot-password', data),
  getCurrentUser: () => api.get('/auth/current-user'),
}

// OTP API
export const otpAPI = {
  generateOTP: (email: string) => api.post('/otp/generate', { email }),
  verifyOTP: (email: string, otp: string) => api.post('/otp/verify', { email, otp }),
}

// Users API
export const usersAPI = {
  getAllUsers: (role?: string) => api.get('/users', { params: { role } }),
  getById: (id: number) => api.get(`/users/${id}`),
  assignCoach: (userId: number, coachId: number) =>
    api.post('/users/assign-coach', { user_id: userId, coach_id: coachId }),
  getUserCoach: (userId: number) => api.get(`/users/${userId}/coach`),
  getUsersByCoach: (coachId: number) => api.get(`/users/coach/${coachId}/users`),
  getUserAnalytics: (userId: number) => api.get(`/users/${userId}/analytics`),
  getAllUsersAnalytics: () => api.get('/users/analytics'),
  getUsersAnalyticsByCoach: (coachId: number) => api.get(`/users/coach/${coachId}/analytics`),
}

// Documents API
export const documentsAPI = {
  upload: (taskId: number, file: File, userTaskId?: number) => {
    const formData = new FormData()
    formData.append('document', file)
    formData.append('task_id', taskId.toString())
    if (userTaskId) {
      formData.append('user_task_id', userTaskId.toString())
    }
    return api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  getTaskDocuments: (taskId: number) => api.get(`/documents/task/${taskId}`),
  getUserTaskDocuments: (userTaskId: number) => api.get(`/documents/user-task/${userTaskId}`),
  getDocumentFile: (documentId: number) => api.get(`/documents/${documentId}/file`, { responseType: 'blob' }),
  deleteDocument: (documentId: number) => api.delete(`/documents/${documentId}`),
  createOrUpdateReportData: (taskId: number, data: any) => api.post(`/documents/task/${taskId}/report-data`, data),
  getReportData: (taskId: number, userTaskId?: number) =>
    api.get(`/documents/task/${taskId}/report-data`, { params: userTaskId ? { user_task_id: userTaskId } : undefined }),
  getUserTaskReportData: (userTaskId: number) => api.get(`/documents/user-task/${userTaskId}/report-data`),
}

// User Tasks API
export const userTasksAPI = {
  getMyTasks: () => api.get('/user-tasks/my-tasks'),
  getUserTasks: (userId: number) => api.get(`/user-tasks/user/${userId}`),
  getUserTasksByEmail: (email: string) => api.get(`/user-tasks/email/${encodeURIComponent(email)}`),
  getAllUserTasks: (coachId?: number) => api.get('/user-tasks/all', { params: { coach_id: coachId } }),
  getMyStats: () => api.get('/user-tasks/my-stats'),
  getUserStats: (userId: number) => api.get(`/user-tasks/stats/${userId}`),
  assignTask: (userId: number, taskId: number) =>
    api.post('/user-tasks/assign', { user_id: userId, task_id: taskId }),
  bulkAssignTask: (taskId: number, userIds: number[]) =>
    api.post('/user-tasks/bulk-assign', { task_id: taskId, user_ids: userIds }),
  updateStatus: (id: number, status: 'COMPLETED' | 'INCOMPLETE', remarks?: string, doneDate?: string) =>
    api.patch(`/user-tasks/${id}/status`, { status, remarks, done_date: doneDate }),
  removeTask: (id: number) => api.delete(`/user-tasks/${id}`),
}

export default api
