import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersAPI, coachesAPI, tasksAPI, userTasksAPI, documentsAPI } from '../services/api'
import ExcelUploader from '../components/ExcelUploader'
import TaskForm from '../components/TaskForm'
import UserTasksModal from '../components/UserTasksModal'

interface UserAnalytics {
  id: number
  name: string
  email: string
  coach_name: string | null
  total_tasks: number
  completed_tasks: number
  incomplete_tasks: number
}

import type { Task } from '../types'

interface UserTask {
  id: number
  user_id: number
  task_id: number
  task_title: string
  task_description: string | null
  task_deadline: string
  status: 'COMPLETED' | 'INCOMPLETE'
  completed_at: string | null
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserAnalytics[]>([])
  const [coaches, setCoaches] = useState<any[]>([])
  const [coachesAnalytics, setCoachesAnalytics] = useState<any[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showBulkTaskAssign, setShowBulkTaskAssign] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [selectedTaskUserIds, setSelectedTaskUserIds] = useState<number[]>([])
  const [viewingUserId, setViewingUserId] = useState<number | null>(null)
  const [userTasks, setUserTasks] = useState<UserTask[]>([])
  const [allTasksList, setAllTasksList] = useState<Task[]>([])
  const [showTasksList, setShowTasksList] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  // Uploading documents is handled per-user-task inside `UserTasksModal` now.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (viewingUserId) {
      loadUserTasks(viewingUserId)
    }
  }, [viewingUserId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersRes, coachesRes, coachesAnalyticsRes, tasksRes] = await Promise.all([
        usersAPI.getAllUsersAnalytics(),
        coachesAPI.getAll(),
        coachesAPI.getAllAnalytics(),
        tasksAPI.getAll(),
      ])
      setUsers(usersRes.data)
      setCoaches(coachesRes.data)
      setCoachesAnalytics(coachesAnalyticsRes.data)
      setTasks(tasksRes.data)
      setAllTasksList(tasksRes.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task? This will also remove all user assignments for this task.')) {
      return
    }

    try {
      setDeletingTaskId(taskId)
      await tasksAPI.delete(taskId)
      setSuccess('Task deleted successfully')
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete task')
      setTimeout(() => setError(''), 5000)
    } finally {
      setDeletingTaskId(null)
    }
  }

  const loadUserTasks = async (userId: number) => {
    try {
      const res = await userTasksAPI.getUserTasks(userId)
      // Show all tasks (not just pending) - the modal will display all
      setUserTasks(res.data)
    } catch (err: any) {
      console.error('Failed to load user tasks:', err)
    }
  }

  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(users.map((u) => u.id))
    } else {
      setSelectedUserIds([])
    }
  }

  const handleUserCheckbox = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUserIds([...selectedUserIds, userId])
    } else {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId))
    }
  }

  const handleBulkAssignCoach = async () => {
    if (selectedUserIds.length === 0 || !selectedCoachId) {
      setError('Please select at least one user and a coach')
      return
    }

    try {
      // Assign coach to each selected user
      await Promise.all(
        selectedUserIds.map((userId) => usersAPI.assignCoach(userId, selectedCoachId))
      )
      setSuccess(`Coach assigned to ${selectedUserIds.length} user(s) successfully`)
      await loadData()
      setSelectedUserIds([])
      setSelectedCoachId(null)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign coach')
    }
  }

  const handleCreateTask = async (data: {
    title: string
    description?: string | null
    start_date: string
    end_date: string
    deadline: string
    allow_document_upload?: number
    report_type?: string | null
  }) => {
    try {
      // Create the task first
      const taskRes = await tasksAPI.create({
        title: data.title,
        description: data.description,
        start_date: data.start_date,
        end_date: data.end_date,
        deadline: data.deadline,
        coach_id: null, // Admin can create tasks without coach
        allow_document_upload: data.allow_document_upload ? 1 : 0,
        report_type: data.allow_document_upload ? (data.report_type || 'SUGAR_REPORT') : null,
      })

      const taskId = taskRes.data.id

      setSuccess('Task created successfully')

      setShowTaskForm(false)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create task')
    }
  }

  const handleBulkAssignTask = async () => {
    if (!selectedTaskId || selectedTaskUserIds.length === 0) {
      setError('Please select a task and at least one user')
      return
    }

    try {
      await userTasksAPI.bulkAssignTask(selectedTaskId, selectedTaskUserIds)
      setSuccess(`Task assigned to ${selectedTaskUserIds.length} user(s) successfully`)
      setShowBulkTaskAssign(false)
      setSelectedTaskId(null)
      setSelectedTaskUserIds([])
      if (viewingUserId) {
        await loadUserTasks(viewingUserId)
      }
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign task')
    }
  }

  const handleToggleTaskStatus = async (userTaskId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'COMPLETED' ? 'INCOMPLETE' : 'COMPLETED'
      await userTasksAPI.updateStatus(userTaskId, newStatus as 'COMPLETED' | 'INCOMPLETE')
      if (viewingUserId) {
        await loadUserTasks(viewingUserId)
      }
      await loadData()
      setSuccess('Task status updated successfully')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update task status')
    }
  }

  const isTaskOverdue = (deadline: string) => {
    return new Date(deadline) < new Date()
  }

  const handleUploadSuccess = (data: any) => {
    setSuccess(`Successfully uploaded ${data.imported} leads${data.usersCreated ? ` and created ${data.usersCreated} user accounts` : ''}`)
    loadData()
    setTimeout(() => setSuccess(''), 5000)
  }

  const handleUploadError = (errorMsg: string) => {
    setError(errorMsg)
    setTimeout(() => setError(''), 5000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen medical-bg p-6 md:p-8">
      <ExcelUploader 
        onUploadSuccess={handleUploadSuccess} 
        onUploadError={handleUploadError}
        allowCoachSelection={true}
      />
      <div className="max-w-7xl mx-auto">
        {/* Modern Medical Header */}
        <div className="medical-header rounded-2xl p-6 mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                  Admin Dashboard
                </span>
              </h1>
              <p className="text-gray-600">Manage your healthcare platform efficiently</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  loadData()
                  if (viewingUserId) {
                    loadUserTasks(viewingUserId)
                  }
                }}
                className="btn-medical-secondary flex items-center gap-2"
                title="Refresh data"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => setShowTaskForm(true)}
                className="btn-medical flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Task
              </button>
              <button
                onClick={() => setShowBulkTaskAssign(true)}
                className="btn-medical-secondary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Assign Tasks
              </button>
              <button
                onClick={() => setShowTasksList(!showTasksList)}
                className="btn-medical-secondary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Manage Tasks
              </button>
              <button
                onClick={() => navigate('/admin/leads')}
                className="btn-medical-secondary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Manage Leads
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="btn-medical-secondary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </button>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold text-xl">
                ×
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* Tasks Management Section */}
        {showTasksList && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">All Tasks Management</h2>
              <button
                onClick={() => setShowTasksList(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Task ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Start Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">End Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Deadline</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allTasksList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No tasks found. Create a task to get started.
                      </td>
                    </tr>
                  ) : (
                    allTasksList.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">#{task.id}</td>
                        <td className="px-4 py-3 text-sm font-medium">{task.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {task.description || <span className="text-gray-400">No description</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(task.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(task.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(task.deadline).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              task.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : task.status === 'OVERDUE'
                                ? 'bg-orange-100 text-orange-800'
                                : task.status === 'PENDING'
                                ? 'bg-red-100 text-red-800'
                                : task.status === 'ON_GOING'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {task.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={deletingTaskId === task.id}
                              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-semibold py-1 px-3 rounded transition-colors"
                            >
                              {deletingTaskId === task.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coaches Analytics Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">All Health Coaches Analytics</h2>
          <div className="overflow-x-auto">
            <table className="medical-table">
              <thead className="bg-blue-400">
                <tr>
                  <th className="text-white uppercase">Coach Name</th>
                  <th className="text-white uppercase">Email</th>
                  <th className="text-white uppercase">Total Users</th>
                  <th className="text-white uppercase">Total Tasks</th>
                  <th className="text-white uppercase">Completed Tasks</th>
                  <th className="text-white uppercase">Pending Tasks</th>
                </tr>
              </thead>
              <tbody>
                {coachesAnalytics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center py-8">
                        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-gray-500">No coaches found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  coachesAnalytics.map((coach) => (
                    <tr key={coach.id}>
                      <td className="font-semibold text-gray-900">{coach.name}</td>
                      <td className="text-gray-600">{coach.email}</td>
                      <td>
                        <span className="medical-badge badge-info">{coach.total_users || 0}</span>
                      </td>
                      <td>
                        <span className="medical-badge badge-info">{coach.total_tasks || 0}</span>
                      </td>
                      <td>
                        <span className="medical-badge badge-success">{coach.completed_tasks || 0}</span>
                      </td>
                      <td>
                        <span className="medical-badge badge-warning">{coach.incomplete_tasks || 0}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bulk Assign Coach Section */}
        <div className="medical-card mb-6 animate-fade-in">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Assign Coach to Users (Bulk)</h2>
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedUserIds.length === users.length && users.length > 0}
                onChange={(e) => handleSelectAllUsers(e.target.checked)}
                className="rounded"
              />
              <span className="font-medium">Select All ({selectedUserIds.length} selected)</span>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                {users.length === 0 ? (
                  <p className="text-gray-500 text-sm">No users available</p>
                ) : (
                  users.map((u) => (
                    <label key={u.id} className="flex items-center space-x-2 mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={(e) => handleUserCheckbox(u.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {u.name} ({u.email}) - {u.coach_name || 'No Coach'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-4">
              <select
                value={selectedCoachId || ''}
                onChange={(e) => setSelectedCoachId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Select Coach</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssignCoach}
                disabled={selectedUserIds.length === 0 || !selectedCoachId}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Assign Coach to {selectedUserIds.length} User(s)
              </button>
            </div>
          </div>
        </div>

        {/* Users Analytics Table */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">All Users Analytics</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-blue-400">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">
                    Assigned Coach
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">
                    Total Tasks
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">
                    Completed
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">
                    Pending
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{user.name}</td>
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3 text-sm">
                      {user.coach_name || <span className="text-gray-400">Not assigned</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">{user.total_tasks || 0}</td>
                    <td className="px-4 py-3 text-sm text-green-600">
                      {user.completed_tasks || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">
                      {user.incomplete_tasks || 0}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => setViewingUserId(user.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Tasks
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Tasks Modal */}
        {viewingUserId && (
          <UserTasksModal
            userId={viewingUserId}
            userName={users.find((u) => u.id === viewingUserId)?.name || 'User'}
            userEmail={users.find((u) => u.id === viewingUserId)?.email || ''}
            coachName={users.find((u) => u.id === viewingUserId)?.coach_name || null}
            onClose={() => {
              setViewingUserId(null)
              setUserTasks([])
            }}
            onTaskUpdate={() => {
              loadData()
            }}
          />
        )}

        {/* Task Form Modal */}
        {showTaskForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="relative bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowTaskForm(false)}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700"
              >
                ×
              </button>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Create New Task</h2>
                <TaskForm
                  task={null}
                  coachId={0}
                  onSubmit={handleCreateTask}
                  onCancel={() => setShowTaskForm(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bulk Task Assignment Modal */}
        {showBulkTaskAssign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Bulk Assign Task to Users</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Task</label>
                  <select
                    value={selectedTaskId || ''}
                    onChange={(e) => setSelectedTaskId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select a task</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title} - {new Date(task.deadline).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Select Users</label>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {/* Select All Option - More Prominent */}
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <label className="flex items-center space-x-2 cursor-pointer hover:bg-blue-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedTaskUserIds.length === users.length && users.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaskUserIds(users.map((u) => u.id))
                            } else {
                              setSelectedTaskUserIds([])
                            }
                          }}
                          className="rounded w-5 h-5 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-blue-700">
                          Select All ({selectedTaskUserIds.length} of {users.length} selected)
                        </span>
                      </label>
                    </div>
                    {/* Individual User Checkboxes */}
                    {users.map((user) => (
                      <label key={user.id} className="flex items-center space-x-2 mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedTaskUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaskUserIds([...selectedTaskUserIds, user.id])
                            } else {
                              setSelectedTaskUserIds(selectedTaskUserIds.filter((id) => id !== user.id))
                            }
                          }}
                          className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">
                          {user.name} ({user.email})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkAssignTask}
                    disabled={!selectedTaskId || selectedTaskUserIds.length === 0}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    Assign Task to {selectedTaskUserIds.length} User(s)
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkTaskAssign(false)
                      setSelectedTaskId(null)
                      setSelectedTaskUserIds([])
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
