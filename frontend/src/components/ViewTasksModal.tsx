import { useState, useEffect } from 'react'
import { userTasksAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

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
  remarks: string | null
  done_date: string | null
  coach_name?: string | null
  user_name?: string
  user_email?: string
}

interface ViewTasksModalProps {
  leadEmail: string
  leadName: string
  coachName?: string | null
  onClose: () => void
  onTaskComplete?: (taskId: number) => void
}

export default function ViewTasksModal({
  leadEmail,
  leadName,
  coachName,
  onClose,
  onTaskComplete,
}: ViewTasksModalProps) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<UserTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null)
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [taskToComplete, setTaskToComplete] = useState<UserTask | null>(null)
  const [remarks, setRemarks] = useState('')
  const [doneDate, setDoneDate] = useState('')

  useEffect(() => {
    loadTasks()
  }, [leadEmail])

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await userTasksAPI.getUserTasksByEmail(leadEmail)
      setTasks(response.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tasks')
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkComplete = (task: UserTask) => {
    setTaskToComplete(task)
    setRemarks('')
    // Set default done date to today
    const today = new Date()
    const formattedDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setDoneDate(formattedDate)
    setShowCompleteForm(true)
  }

  const handleSubmitComplete = async () => {
    if (!taskToComplete) return

    try {
      setCompletingTaskId(taskToComplete.id)
      const doneDateValue = doneDate ? new Date(doneDate).toISOString() : new Date().toISOString()
      await userTasksAPI.updateStatus(
        taskToComplete.id,
        'COMPLETED' as 'COMPLETED' | 'INCOMPLETE',
        remarks.trim() || undefined,
        doneDateValue
      )
      setShowCompleteForm(false)
      setTaskToComplete(null)
      setRemarks('')
      setDoneDate('')
      await loadTasks()
      if (onTaskComplete) {
        onTaskComplete(taskToComplete.id)
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to complete task')
    } finally {
      setCompletingTaskId(null)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'ON_GOING':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'PENDING':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'OVERDUE':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'OPEN':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isHealthCoach = user?.role === 'COACH' || user?.role === 'ADMIN'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">
              Tasks for {coachName || (tasks.length > 0 && tasks[0].coach_name) || 'Coach'}
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              {coachName || (tasks.length > 0 && tasks[0].coach_name) ? `${leadName} (${leadEmail})` : leadEmail}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
              {error}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="mt-4 text-gray-500 font-semibold">No tasks assigned to this user.</p>
              <p className="mt-2 text-sm text-gray-400">
                Tasks need to be assigned to users before they appear here.
                <br />
                Use the "Assign Tasks" feature in the Admin Dashboard to assign tasks to users.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Task ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Task Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Done Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Remarks
                    </th>
                    {isHealthCoach && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">#{task.task_id}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium text-gray-900">{task.task_title}</div>
                          {task.task_description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {task.task_description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(task.task_start_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(task.task_end_date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(
                            task.task_status
                          )}`}
                        >
                          {task.task_status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.done_date ? formatDate(task.done_date) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.remarks ? (
                          <span className="text-xs" title={task.remarks}>
                            {task.remarks.length > 30 ? task.remarks.substring(0, 30) + '...' : task.remarks}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      {isHealthCoach && (
                        <td className="px-4 py-3 text-sm">
                          {task.status === 'COMPLETED' ? (
                            <span className="text-green-600 font-semibold">Completed</span>
                          ) : (
                            <button
                              onClick={() => handleMarkComplete(task)}
                              disabled={completingTaskId === task.id}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-semibold py-1 px-3 rounded transition-colors"
                            >
                              {completingTaskId === task.id ? 'Completing...' : 'Mark Complete'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Complete Task Form Modal */}
      {showCompleteForm && taskToComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Mark Task as Completed</h3>
            <p className="text-sm text-gray-600 mb-4">
              Task: <span className="font-semibold">{taskToComplete.task_title}</span>
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Done Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={doneDate}
                  onChange={(e) => setDoneDate(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                  placeholder="Enter remarks about the call or task completion..."
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitComplete}
                disabled={!doneDate || completingTaskId === taskToComplete.id}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {completingTaskId === taskToComplete.id ? 'Saving...' : 'Mark as Completed'}
              </button>
              <button
                onClick={() => {
                  setShowCompleteForm(false)
                  setTaskToComplete(null)
                  setRemarks('')
                  setDoneDate('')
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
