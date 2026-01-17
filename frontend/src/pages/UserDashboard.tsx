import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { usersAPI, userTasksAPI } from '../services/api'

interface Task {
  id: number
  task_id: number
  task_title: string
  task_description: string | null
  task_deadline: string
  status: 'COMPLETED' | 'INCOMPLETE'
  completed_at: string | null
}

interface TaskStats {
  total: number
  completed: number
  incomplete: number
  completion_percentage: number
}

export default function UserDashboard() {
  const { user, logout } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    incomplete: 0,
    completion_percentage: 0,
  })
  const [coach, setCoach] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user])

  // Auto-refresh data every 30 seconds to stay synchronized
  useEffect(() => {
    if (user?.id && !loading) {
      const interval = setInterval(() => {
        loadData()
      }, 30000) // Refresh every 30 seconds

      return () => clearInterval(interval)
    }
  }, [user, loading])

  const loadData = async () => {
    try {
      setLoading(true)
      if (user?.id) {
        const [tasksRes, statsRes, coachRes] = await Promise.all([
          userTasksAPI.getMyTasks(),
          userTasksAPI.getMyStats(),
          usersAPI.getUserCoach(user.id),
        ])
        setTasks(tasksRes.data)
        setStats(statsRes.data)
        setCoach(coachRes.data.coach)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadData()
  }

  const handleTaskStatusChange = async (taskId: number, currentStatus: string) => {
    try {
      setUpdatingTaskId(taskId)
      const newStatus = currentStatus === 'COMPLETED' ? 'INCOMPLETE' : 'COMPLETED'
      
      // Optimistically update UI
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus as 'COMPLETED' | 'INCOMPLETE', completed_at: newStatus === 'COMPLETED' ? new Date().toISOString() : null }
            : task
        )
      )
      
      // Update stats optimistically
      setStats(prevStats => {
        if (newStatus === 'COMPLETED') {
          return {
            ...prevStats,
            completed: prevStats.completed + 1,
            incomplete: prevStats.incomplete - 1,
            completion_percentage: prevStats.total > 0 
              ? Math.round(((prevStats.completed + 1) / prevStats.total) * 100)
              : 0
          }
        } else {
          return {
            ...prevStats,
            completed: prevStats.completed - 1,
            incomplete: prevStats.incomplete + 1,
            completion_percentage: prevStats.total > 0 
              ? Math.round(((prevStats.completed - 1) / prevStats.total) * 100)
              : 0
          }
        }
      })
      
      // Make API call
      await userTasksAPI.updateStatus(taskId, newStatus as 'COMPLETED' | 'INCOMPLETE')
      
      // Show success message
      setMessage(newStatus === 'COMPLETED' ? 'Task marked as completed!' : 'Task marked as incomplete')
      setTimeout(() => setMessage(''), 3000)
      
      // Reload data to ensure synchronization
      await loadData()
    } catch (error: any) {
      // Revert optimistic update on error
      await loadData()
      setMessage(error.response?.data?.error || 'Failed to update task status')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setUpdatingTaskId(null)
    }
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">User Dashboard</h1>
          <div className="flex gap-4 items-center">
            <span className="text-gray-700">Welcome, {user?.name}</span>
            <button
              onClick={handleRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              title="Refresh data"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Welcome Back!</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Name</p>
              <p className="text-lg font-semibold">{user?.name}</p>
            </div>
            <div>
              <p className="text-gray-600">Assigned Health Coach</p>
              <p className="text-lg font-semibold">
                {coach ? coach.coach_name : 'No coach assigned'}
              </p>
            </div>
          </div>
        </div>

        {/* Task Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-100 rounded-lg p-4 shadow-md">
            <p className="text-sm font-medium text-blue-800">Total Tasks</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-green-100 rounded-lg p-4 shadow-md">
            <p className="text-sm font-medium text-green-800">Completed</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{stats.completed}</p>
          </div>
          <div className="bg-red-100 rounded-lg p-4 shadow-md">
            <p className="text-sm font-medium text-red-800">Pending</p>
            <p className="text-3xl font-bold text-red-900 mt-1">{stats.incomplete}</p>
          </div>
          <div className="bg-purple-100 rounded-lg p-4 shadow-md">
            <p className="text-sm font-medium text-purple-800">Completion %</p>
            <p className="text-3xl font-bold text-purple-900 mt-1">
              {stats.completion_percentage}%
            </p>
          </div>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.includes('completed') || message.includes('success')
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* My Tasks List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">My Tasks</h2>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No tasks assigned yet.</p>
              {coach ? (
                <p className="text-sm text-gray-600">
                  Your Health Coach ({coach.coach_name}) will assign tasks to you soon.
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Please contact your admin to get assigned to a Health Coach.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const deadline = new Date(task.task_deadline)
                const isOverdue = task.status === 'INCOMPLETE' && deadline < new Date()
                const isCompleted = task.status === 'COMPLETED'

                return (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-4 transition-all duration-300 transform ${
                      isCompleted
                        ? 'bg-green-50 border-green-300 shadow-md'
                        : 'bg-white border-gray-300 hover:border-blue-400'
                    } ${isOverdue ? 'ring-2 ring-red-500' : ''} ${
                      updatingTaskId === task.id ? 'opacity-50' : 'hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`font-semibold text-lg transition-colors duration-300 ${
                              isCompleted ? 'text-green-800 line-through' : 'text-gray-900'
                            }`}
                          >
                            {task.task_title}
                          </h3>
                          {isCompleted && (
                            <span className="text-green-600 text-xl animate-bounce">✓</span>
                          )}
                        </div>
                        {task.task_description && (
                          <p
                            className={`text-sm mt-2 ${
                              isCompleted ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {task.task_description}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-2">
                          Deadline:{' '}
                          {deadline.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {isOverdue && (
                            <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 rounded text-xs font-bold">
                              OVERDUE
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleTaskStatusChange(task.id, task.status)}
                        disabled={updatingTaskId === task.id}
                        className={`ml-4 px-4 py-2 rounded-lg transition-all transform ${
                          updatingTaskId === task.id
                            ? 'bg-gray-400 cursor-not-allowed'
                            : isCompleted
                            ? 'bg-green-600 hover:bg-green-700 hover:scale-105 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 text-white'
                        } ${isCompleted ? 'shadow-lg' : 'shadow-md'}`}
                      >
                        {updatingTaskId === task.id ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Updating...
                          </span>
                        ) : (
                          isCompleted ? '✓ Completed' : 'Mark as Complete'
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
