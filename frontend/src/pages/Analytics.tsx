import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { userTasksAPI, tasksAPI } from '../services/api'

interface UserTask {
  id: number
  task_id: number
  task_title: string
  task_description: string | null
  task_start_date: string
  task_end_date: string
  task_deadline: string
  task_status?: 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED' | 'OVERDUE'
  status: 'COMPLETED' | 'INCOMPLETE'
  completed_at: string | null
  done_date?: string | null
  user_name?: string
  user_email?: string
  coach_name?: string | null
}

export default function Analytics() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [allTasks, setAllTasks] = useState<UserTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED' | 'OVERDUE'>('ALL')
  const [filterUser, setFilterUser] = useState<string>('')
  const [filterDateRange, setFilterDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })

  useEffect(() => {
    loadAllTasks()
  }, [])

  const loadAllTasks = async () => {
    try {
      setLoading(true)
      setError(null)

      // Use the new getAllUserTasks endpoint
      const tasksRes = await userTasksAPI.getAllUserTasks()
      setAllTasks(tasksRes.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tasks')
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  // Group tasks by status
  const groupedTasks = {
    OPEN: allTasks.filter((t) => t.task_status === 'OPEN'),
    ON_GOING: allTasks.filter((t) => t.task_status === 'ON_GOING'),
    PENDING: allTasks.filter((t) => t.task_status === 'PENDING'),
    COMPLETED: allTasks.filter((t) => t.task_status === 'COMPLETED'),
    OVERDUE: allTasks.filter((t) => t.task_status === 'OVERDUE'),
  }

  // Apply filters
  const filteredTasks = {
    OPEN: filterStatus === 'ALL' || filterStatus === 'OPEN' ? applyFilters(groupedTasks.OPEN) : [],
    ON_GOING: filterStatus === 'ALL' || filterStatus === 'ON_GOING' ? applyFilters(groupedTasks.ON_GOING) : [],
    PENDING: filterStatus === 'ALL' || filterStatus === 'PENDING' ? applyFilters(groupedTasks.PENDING) : [],
    COMPLETED: filterStatus === 'ALL' || filterStatus === 'COMPLETED' ? applyFilters(groupedTasks.COMPLETED) : [],
    OVERDUE: filterStatus === 'ALL' || filterStatus === 'OVERDUE' ? applyFilters(groupedTasks.OVERDUE) : [],
  }

  function applyFilters(tasks: UserTask[]): UserTask[] {
    let filtered = [...tasks]

    // Filter by user name/email
    if (filterUser) {
      const searchTerm = filterUser.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.user_name?.toLowerCase().includes(searchTerm) ||
          t.user_email?.toLowerCase().includes(searchTerm)
      )
    }

    // Filter by date range
    if (filterDateRange.start) {
      const startDate = new Date(filterDateRange.start)
      filtered = filtered.filter((t) => new Date(t.task_start_date) >= startDate)
    }
    if (filterDateRange.end) {
      const endDate = new Date(filterDateRange.end)
      endDate.setHours(23, 59, 59, 999) // Include entire end date
      filtered = filtered.filter((t) => new Date(t.task_end_date) <= endDate)
    }

    return filtered
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-50 border-green-200'
      case 'ON_GOING':
        return 'bg-blue-50 border-blue-200'
      case 'PENDING':
        return 'bg-red-50 border-red-200'
      case 'OVERDUE':
        return 'bg-orange-50 border-orange-200'
      case 'OPEN':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getStatusHeaderColor = (status: string) => {
    // All status headers use light blue background with white text
    return 'bg-blue-400 text-white'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-teal-600">Task Analytics</h1>
              <p className="text-gray-600 mt-1">Kanban view of all tasks</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadAllTasks}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                title="Refresh data"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Back to Admin
                </button>
              )}
              {user?.role === 'COACH' && (
                <button
                  onClick={() => navigate('/coach-dashboard')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Back to Coach Dashboard
                </button>
              )}
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ON_GOING">On-going</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
              <input
                type="text"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="Search by name or email"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filterDateRange.start}
                onChange={(e) => setFilterDateRange({ ...filterDateRange, start: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filterDateRange.end}
                onChange={(e) => setFilterDateRange({ ...filterDateRange, end: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Kanban Board */}
        {!error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Open Column */}
            <div className={`rounded-lg border-2 ${getStatusColor('OPEN')}`}>
              <div className={`${getStatusHeaderColor('OPEN')} p-3 rounded-t-lg`}>
                <h3 className="font-bold uppercase">
                  Open ({filteredTasks.OPEN.length})
                </h3>
              </div>
              <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredTasks.OPEN.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No open tasks</p>
                ) : (
                  filteredTasks.OPEN.map((task) => (
                    <TaskCard key={task.id} task={task} formatDate={formatDate} />
                  ))
                )}
              </div>
            </div>

            {/* On-going Column */}
            <div className={`rounded-lg border-2 ${getStatusColor('ON_GOING')}`}>
              <div className={`${getStatusHeaderColor('ON_GOING')} p-3 rounded-t-lg`}>
                <h3 className="font-bold uppercase">
                  On-going ({filteredTasks.ON_GOING.length})
                </h3>
              </div>
              <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredTasks.ON_GOING.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No on-going tasks</p>
                ) : (
                  filteredTasks.ON_GOING.map((task) => (
                    <TaskCard key={task.id} task={task} formatDate={formatDate} />
                  ))
                )}
              </div>
            </div>

            {/* Pending Column */}
            <div className={`rounded-lg border-2 ${getStatusColor('PENDING')}`}>
              <div className={`${getStatusHeaderColor('PENDING')} p-3 rounded-t-lg`}>
                <h3 className="font-bold uppercase">
                  Pending ({filteredTasks.PENDING.length})
                </h3>
              </div>
              <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredTasks.PENDING.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No pending tasks</p>
                ) : (
                  filteredTasks.PENDING.map((task) => (
                    <TaskCard key={task.id} task={task} formatDate={formatDate} />
                  ))
                )}
              </div>
            </div>

            {/* Overdue Column */}
            <div className={`rounded-lg border-2 ${getStatusColor('OVERDUE')}`}>
              <div className={`${getStatusHeaderColor('OVERDUE')} p-3 rounded-t-lg`}>
                <h3 className="font-bold uppercase">
                  Overdue ({filteredTasks.OVERDUE.length})
                </h3>
              </div>
              <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredTasks.OVERDUE.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No overdue tasks</p>
                ) : (
                  filteredTasks.OVERDUE.map((task) => (
                    <TaskCard key={task.id} task={task} formatDate={formatDate} />
                  ))
                )}
              </div>
            </div>

            {/* Completed Column */}
            <div className={`rounded-lg border-2 ${getStatusColor('COMPLETED')}`}>
              <div className={`${getStatusHeaderColor('COMPLETED')} p-3 rounded-t-lg`}>
                <h3 className="font-bold uppercase">
                  Completed ({filteredTasks.COMPLETED.length})
                </h3>
              </div>
              <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
                {filteredTasks.COMPLETED.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No completed tasks</p>
                ) : (
                  filteredTasks.COMPLETED.map((task) => (
                    <TaskCard key={task.id} task={task} formatDate={formatDate} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface TaskCardProps {
  task: UserTask
  formatDate: (date: string) => string
}

function TaskCard({ task, formatDate }: TaskCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow">
      <h4 className="font-semibold text-gray-900 mb-2">{task.task_title}</h4>
      {task.task_description && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.task_description}</p>
      )}
      <div className="space-y-1 text-xs text-gray-500">
        {task.user_name && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {task.user_name}
          </div>
        )}
        {task.coach_name && (
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Coach: {task.coach_name}
          </div>
        )}
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {formatDate(task.task_start_date)} - {formatDate(task.task_end_date)}
        </div>
        {task.task_status === 'COMPLETED' && task.done_date && (
          <div className="text-green-600 font-semibold">
            ✓ Completed {formatDate(task.done_date)}
          </div>
        )}
        {task.task_status === 'OVERDUE' && task.done_date && (
          <div className="text-orange-600 font-semibold">
            ⚠ Overdue - Completed {formatDate(task.done_date)}
          </div>
        )}
      </div>
    </div>
  )
}
