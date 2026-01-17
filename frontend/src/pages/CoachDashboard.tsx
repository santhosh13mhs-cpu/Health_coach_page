import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CoachSelector from '../components/CoachSelector'
import TaskStats from '../components/TaskStats'
import TaskKanban from '../components/TaskKanban'
import TaskForm from '../components/TaskForm'
import { coachesAPI, tasksAPI } from '../services/api'
import { Coach, Task, TaskStats as TaskStatsType, Lead } from '../types'

export default function CoachDashboard() {
  const navigate = useNavigate()
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [taskStats, setTaskStats] = useState<TaskStatsType>({
    total: 0,
    completed: 0,
    incomplete: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCoachForm, setShowCoachForm] = useState(false)
  const [newCoachName, setNewCoachName] = useState('')
  const [newCoachEmail, setNewCoachEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCoaches()
  }, [])

  useEffect(() => {
    if (selectedCoachId) {
      loadTasks()
      loadLeads()
      loadTaskStats()
    } else {
      setTasks([])
      setLeads([])
      setTaskStats({ total: 0, completed: 0, incomplete: 0 })
    }
  }, [selectedCoachId])

  const loadCoaches = async () => {
    try {
      const response = await coachesAPI.getAll()
      setCoaches(response.data)
      if (response.data.length > 0 && !selectedCoachId) {
        setSelectedCoachId(response.data[0].id)
      }
    } catch (err) {
      setError('Failed to load coaches')
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    if (!selectedCoachId) return
    try {
      const response = await tasksAPI.getByDate(selectedCoachId)
      // Transform grouped tasks to flat array
      const allTasks: Task[] = []
      Object.values(response.data).forEach((dateTasks: any) => {
        allTasks.push(...dateTasks)
      })
      setTasks(allTasks)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    }
  }

  const loadLeads = async () => {
    if (!selectedCoachId) return
    try {
      const response = await coachesAPI.getLeads(selectedCoachId)
      setLeads(response.data)
    } catch (err) {
      console.error('Failed to load leads:', err)
    }
  }

  const loadTaskStats = async () => {
    if (!selectedCoachId) return
    try {
      const response = await tasksAPI.getStats(selectedCoachId)
      setTaskStats(response.data)
    } catch (err) {
      console.error('Failed to load task stats:', err)
    }
  }

  const handleCreateCoach = async () => {
    if (!newCoachName.trim() || !newCoachEmail.trim()) {
      setError('Name and email are required')
      return
    }

    try {
      await coachesAPI.create({ name: newCoachName.trim(), email: newCoachEmail.trim() })
      setNewCoachName('')
      setNewCoachEmail('')
      setShowCoachForm(false)
      await loadCoaches()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create coach')
    }
  }

  const handleCreateTask = async (data: {
    title: string
    description?: string | null
    start_date: string
    end_date: string
    deadline: string
  }) => {
    if (!selectedCoachId) return

    try {
      await tasksAPI.create({
        ...data,
        coach_id: selectedCoachId,
      })
      setShowTaskForm(false)
      await loadTasks()
      await loadTaskStats()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create task')
    }
  }

  const handleUpdateTask = async (data: {
    title: string
    description?: string | null
    start_date: string
    end_date: string
    deadline: string
  }) => {
    if (!editingTask) return

    try {
      await tasksAPI.update(editingTask.id, data)
      setEditingTask(null)
      setShowTaskForm(false)
      await loadTasks()
      await loadTaskStats()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update task')
    }
  }

  const handleStatusChange = async (taskId: number, status: 'completed' | 'incomplete') => {
    try {
      await tasksAPI.updateStatus(taskId, status)
      await loadTasks()
      await loadTaskStats()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update task status')
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await tasksAPI.delete(taskId)
      await loadTasks()
      await loadTaskStats()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete task')
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (selectedCoachId) {
                  loadTasks()
                  loadLeads()
                  loadTaskStats()
                }
                loadCoaches()
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              title="Refresh data"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Back to Leads
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        {/* Coach Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Select Coach</h2>
            <button
              onClick={() => setShowCoachForm(!showCoachForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {showCoachForm ? 'Cancel' : '+ Add Coach'}
            </button>
          </div>

          {showCoachForm ? (
            <div className="border-t pt-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Coach Name"
                  value={newCoachName}
                  onChange={(e) => setNewCoachName(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="email"
                  placeholder="Coach Email"
                  value={newCoachEmail}
                  onChange={(e) => setNewCoachEmail(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleCreateCoach}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Create Coach
              </button>
            </div>
          ) : (
            <CoachSelector
              selectedCoachId={selectedCoachId}
              onSelect={setSelectedCoachId}
              allowNone={false}
            />
          )}
        </div>

        {selectedCoachId && (
          <>
            {/* Task Stats */}
            <TaskStats stats={taskStats} />

            {/* Create Task Button */}
            <div className="mb-6">
              <button
                onClick={() => {
                  setEditingTask(null)
                  setShowTaskForm(true)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create New Task
              </button>
            </div>

            {/* Task Form Modal */}
            {showTaskForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowTaskForm(false)
                      setEditingTask(null)
                    }}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700"
                  >
                    ×
                  </button>
                  <TaskForm
                    task={editingTask}
                    coachId={selectedCoachId}
                    onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
                    onCancel={() => {
                      setShowTaskForm(false)
                      setEditingTask(null)
                    }}
                  />
                </div>
              </div>
            )}

            {/* Task Kanban */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold mb-6">Tasks</h2>
              <TaskKanban
                tasks={tasks}
                onStatusChange={handleStatusChange}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
              />
            </div>

            {/* Assigned Leads */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4">Assigned Leads ({leads.length})</h2>
              {leads.length === 0 ? (
                <p className="text-gray-500">No leads assigned to this coach.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Phone
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Assigned Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{lead.name}</td>
                          <td className="px-4 py-3 text-sm">{lead.phone_number}</td>
                          <td className="px-4 py-3 text-sm">{lead.email}</td>
                          <td className="px-4 py-3 text-sm">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
