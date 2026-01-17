import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersAPI, tasksAPI, userTasksAPI, coachesAPI, documentsAPI } from '../services/api'
import TaskForm from '../components/TaskForm'
import UserTasksModal from '../components/UserTasksModal'

interface User {
  id: number
  name: string
  email: string
  assigned_at?: string
}

interface UserAnalytics {
  id: number
  name: string
  email: string
  coach_name: string | null
  total_tasks: number
  completed_tasks: number
  incomplete_tasks: number
}

interface Task {
  id: number
  title: string
  description: string | null
  deadline: string
  created_at: string
}

interface UserTask {
  id: number
  user_id: number
  task_id: number
  task_title: string
  task_description: string | null
  task_deadline: string
  status: 'COMPLETED' | 'INCOMPLETE'
  completed_at: string | null
  user_name?: string
  user_email?: string
}

export default function CoachDashboardEnhanced() {
  const { user: currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [coachId, setCoachId] = useState<number | null>(null)
  const [coachName, setCoachName] = useState<string>('')
  const [assignedUsers, setAssignedUsers] = useState<User[]>([])
  const [usersAnalytics, setUsersAnalytics] = useState<UserAnalytics[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [viewingUserId, setViewingUserId] = useState<number | null>(null)
  const [userTasks, setUserTasks] = useState<UserTask[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [pendingTasks, setPendingTasks] = useState<UserTask[]>([])
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'tasks' | 'analytics'>('analytics')

  useEffect(() => {
    loadCoachData()
  }, [])

  useEffect(() => {
    if (selectedUserId) {
      loadUserTasks(selectedUserId)
    }
  }, [selectedUserId])

  useEffect(() => {
    if (coachId) {
      loadPendingTasks()
    }
  }, [coachId, usersAnalytics])

  // Load pending tasks when switching to tasks tab
  useEffect(() => {
    if (coachId && activeTab === 'tasks') {
      console.log('Switched to tasks tab, loading pending tasks...')
      loadPendingTasks()
    }
  }, [activeTab, coachId])

  // Auto-refresh pending tasks every 30 seconds when on tasks tab
  useEffect(() => {
    if (coachId && activeTab === 'tasks') {
      const interval = setInterval(() => {
        console.log('Auto-refreshing pending tasks...')
        loadPendingTasks()
      }, 30000) // Refresh every 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [coachId, activeTab])

  useEffect(() => {
    if (viewingUserId) {
      loadUserTasksForView(viewingUserId)
    }
  }, [viewingUserId])

  const loadCoachData = async () => {
    try {
      setLoading(true)
      setError('')
      
      if (!currentUser?.email) {
        setError('User email not found. Please log in again.')
        setLoading(false)
        return
      }

      console.log('Loading coach data for user:', currentUser.email)
      
      // Get coach by current user's email (case-insensitive match)
      const coachesRes = await coachesAPI.getAll()
      const coach = coachesRes.data.find((c: any) => 
        c.email?.toLowerCase() === currentUser.email?.toLowerCase()
      )
      
      console.log('Found coach:', coach ? { id: coach.id, name: coach.name, email: coach.email } : 'Not found')
      
      if (coach) {
        setCoachId(coach.id)
        setCoachName(coach.name || currentUser?.name || '')
        console.log('Loading users and analytics for coach ID:', coach.id)
        
        try {
          const [usersRes, analyticsRes] = await Promise.all([
            usersAPI.getUsersByCoach(coach.id),
            usersAPI.getUsersAnalyticsByCoach(coach.id),
          ])
          
          console.log('Loaded users:', usersRes.data.length)
          console.log('Loaded analytics:', analyticsRes.data.length)
          
          setAssignedUsers(usersRes.data)
          setUsersAnalytics(analyticsRes.data)
        } catch (err: any) {
          console.error('Failed to load users/analytics:', err)
          setError(err.response?.data?.error || 'Failed to load user data')
          setAssignedUsers([])
          setUsersAnalytics([])
        }
      } else {
        // Coach profile not found - try to create one automatically
        if (currentUser?.role === 'COACH' && currentUser?.email && currentUser?.name) {
          console.log('Coach profile not found, creating one...')
          try {
            const createRes = await coachesAPI.create({
              name: currentUser.name,
              email: currentUser.email,
            })
            setCoachId(createRes.data.id)
            setCoachName(currentUser.name || '')
            console.log('Created coach profile with ID:', createRes.data.id)
            setAssignedUsers([])
            setUsersAnalytics([])
          } catch (err: any) {
            console.error('Failed to create coach profile:', err)
            if (err.response?.status === 400 || err.response?.status === 409) {
              // Try to find the coach again (might have been created by another request)
              const coachesRes = await coachesAPI.getAll()
              const existingCoach = coachesRes.data.find((c: any) => 
                c.email?.toLowerCase() === currentUser.email?.toLowerCase()
              )
              if (existingCoach) {
                console.log('Found existing coach after creation attempt:', existingCoach.id)
                setCoachId(existingCoach.id)
                setCoachName(existingCoach.name || currentUser.name || '')
                // Try to load users/analytics for this coach
                try {
                  const [usersRes, analyticsRes] = await Promise.all([
                    usersAPI.getUsersByCoach(existingCoach.id),
                    usersAPI.getUsersAnalyticsByCoach(existingCoach.id),
                  ])
                  setAssignedUsers(usersRes.data)
                  setUsersAnalytics(analyticsRes.data)
                } catch (loadErr) {
                  console.error('Failed to load users after finding coach:', loadErr)
                  setAssignedUsers([])
                  setUsersAnalytics([])
                }
              } else {
                setError('Coach profile not found and could not be created. Please contact admin.')
                setAssignedUsers([])
                setUsersAnalytics([])
              }
            } else {
              setError(err.response?.data?.error || 'Failed to create coach profile')
              setAssignedUsers([])
              setUsersAnalytics([])
            }
          }
        } else {
          setError('Coach profile not found. Please contact admin to create your coach profile.')
          setAssignedUsers([])
          setUsersAnalytics([])
        }
      }

      const tasksRes = await tasksAPI.getAll()
      setAllTasks(tasksRes.data)
    } catch (err: any) {
      console.error('Error in loadCoachData:', err)
      setError(err.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingTasks = async () => {
    if (!coachId) {
      console.log('loadPendingTasks: No coachId, skipping')
      return
    }
    
    console.log('loadPendingTasks: Loading pending tasks for coach', coachId)
    try {
      // Get all users assigned to this coach
      const analytics = await usersAPI.getUsersAnalyticsByCoach(coachId)
      console.log('loadPendingTasks: Found users:', analytics.data.length)
      
      const allPendingTasks: UserTask[] = []
      
      // Get tasks for each user in parallel
      const taskPromises = analytics.data.map(async (user: any) => {
        try {
          const tasksRes = await userTasksAPI.getUserTasks(user.id)
          // Filter for incomplete tasks (these are the ones not finished)
          const incompleteTasks = tasksRes.data.filter(
            (task: UserTask) => task.status === 'INCOMPLETE'
          )
          console.log(`loadPendingTasks: User ${user.name} has ${incompleteTasks.length} incomplete tasks`)
          
          // Add user information to each task for display
          return incompleteTasks.map((task: UserTask) => ({
            ...task,
            user_name: user.name,
            user_email: user.email,
            user_id: user.id
          }))
        } catch (err) {
          console.error(`Failed to load tasks for user ${user.id}:`, err)
          return []
        }
      })
      
      const taskArrays = await Promise.all(taskPromises)
      taskArrays.forEach(tasks => allPendingTasks.push(...tasks))
      
      console.log('loadPendingTasks: Total pending tasks found:', allPendingTasks.length)
      
      // Sort by deadline (overdue tasks first, then by earliest deadline)
      allPendingTasks.sort((a, b) => {
        const now = new Date()
        const aDeadline = new Date(a.task_deadline)
        const bDeadline = new Date(b.task_deadline)
        const aOverdue = aDeadline < now
        const bOverdue = bDeadline < now
        
        // Overdue tasks come first
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1
        
        // If both overdue or both not overdue, sort by deadline
        return aDeadline.getTime() - bDeadline.getTime()
      })
      
      setPendingTasks(allPendingTasks)
      console.log('loadPendingTasks: Successfully loaded', allPendingTasks.length, 'pending tasks')
    } catch (err: any) {
      console.error('Failed to load pending tasks:', err)
      console.error('Error details:', err.response?.data || err.message)
      setPendingTasks([])
      setError(`Failed to load pending tasks: ${err.response?.data?.error || err.message}`)
    }
  }

  const loadUserTasks = async (userId: number) => {
    try {
      const res = await userTasksAPI.getUserTasks(userId)
      setUserTasks(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load user tasks')
    }
  }

  const loadUserTasksForView = async (userId: number) => {
    try {
      const res = await userTasksAPI.getUserTasks(userId)
      setUserTasks(res.data)
    } catch (err: any) {
      console.error('Failed to load user tasks:', err)
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
      setError('')
      let currentCoachId = coachId
      if (!currentCoachId && currentUser?.role === 'COACH' && currentUser?.email) {
        try {
          const coachesRes = await coachesAPI.getAll()
          const coach = coachesRes.data.find((c: any) => c.email === currentUser.email)
          if (coach) {
            currentCoachId = coach.id
            setCoachId(coach.id)
          } else {
            const createRes = await coachesAPI.create({
              name: currentUser.name,
              email: currentUser.email,
            })
            currentCoachId = createRes.data.id
            setCoachId(createRes.data.id)
          }
        } catch (err) {
          console.warn('Could not create/find coach profile')
        }
      }
      
      const taskRes = await tasksAPI.create({
        title: data.title,
        description: data.description,
        start_date: data.start_date,
        end_date: data.end_date,
        deadline: data.deadline,
        coach_id: currentCoachId || null,
        allow_document_upload: data.allow_document_upload ? 1 : 0,
        report_type: data.allow_document_upload ? (data.report_type || 'SUGAR_REPORT') : null,
      })

      setSuccess('Task created successfully')
      
      setShowTaskForm(false)
      await loadCoachData()
      await loadPendingTasks()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create task')
    }
  }

  const handleBulkAssign = async () => {
    if (!selectedTaskId || selectedUserIds.length === 0) {
      setError('Please select a task and at least one user')
      return
    }

    try {
      await userTasksAPI.bulkAssignTask(selectedTaskId, selectedUserIds)
      setSuccess(`Task assigned to ${selectedUserIds.length} user(s) successfully`)
      setError('')
      setShowBulkAssign(false)
      setSelectedTaskId(null)
      setSelectedUserIds([])
      await Promise.all([
        loadCoachData(),
        loadPendingTasks(),
        selectedUserId ? loadUserTasks(selectedUserId) : Promise.resolve()
      ])
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign tasks')
    }
  }

  const handleToggleTaskStatus = async (userTaskId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'COMPLETED' ? 'INCOMPLETE' : 'COMPLETED'
      await userTasksAPI.updateStatus(userTaskId, newStatus as 'COMPLETED' | 'INCOMPLETE')
      if (viewingUserId) {
        await loadUserTasksForView(viewingUserId)
      }
      if (selectedUserId) {
        await loadUserTasks(selectedUserId)
      }
      await loadCoachData()
      await loadPendingTasks()
      setSuccess('Task status updated successfully')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update task status')
    }
  }

  const isTaskOverdue = (deadline: string) => {
    return new Date(deadline) < new Date()
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
        {/* Greeting Message */}
        <div className="mb-4">
          <p className="text-xl font-semibold">
            Hi <span className="bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent">{coachName || currentUser?.name || 'Coach'}</span>, welcome!
          </p>
        </div>
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent">Coach Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => {
                loadCoachData()
                if (selectedUserId) {
                  loadUserTasks(selectedUserId)
                }
                if (coachId) {
                  loadPendingTasks()
                }
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
              onClick={() => navigate('/analytics')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Analytics
            </button>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
            <button onClick={() => setError('')} className="float-right font-bold">
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4 border-b">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 font-semibold ${
                activeTab === 'analytics'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Users Analytics
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-semibold ${
                activeTab === 'users'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Assigned Users
            </button>
            <button
              onClick={() => {
                setActiveTab('tasks')
                if (coachId) {
                  loadPendingTasks()
                }
              }}
              className={`px-4 py-2 font-semibold ${
                activeTab === 'tasks'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending Tasks ({pendingTasks.length})
            </button>
          </div>
        </div>

        {/* Users Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">All Users Analytics</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTaskForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Create Task
                </button>
                <button
                  onClick={() => setShowBulkAssign(true)}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Bulk Assign Task
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-blue-400">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">Email</th>
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
                  {usersAnalytics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {coachId 
                          ? 'No users assigned to you yet. Contact admin to assign users to your coach profile.'
                          : 'Coach profile not found. Please contact admin to create your coach profile.'}
                      </td>
                    </tr>
                  ) : (
                    usersAnalytics.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{user.name}</td>
                        <td className="px-4 py-3 text-sm">{user.email}</td>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Assigned Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Assigned Users ({assignedUsers.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTaskForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Create Task
                </button>
                <button
                  onClick={() => setShowBulkAssign(true)}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Bulk Assign Task
                </button>
              </div>
            </div>

            {assignedUsers.length === 0 ? (
              <p className="text-gray-500">No users assigned to you yet.</p>
            ) : (
              <div className="space-y-2">
                {assignedUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedUserId === user.id
                        ? 'bg-indigo-50 border-indigo-500'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{user.name}</h3>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      {selectedUserId === user.id && (
                        <span className="text-indigo-600 font-medium">Selected</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected User's Tasks */}
            {selectedUserId && (
              <div className="mt-6 bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">
                  Tasks for {assignedUsers.find((u) => u.id === selectedUserId)?.name}
                </h3>
                {userTasks.length === 0 ? (
                  <p className="text-gray-500">No tasks assigned to this user.</p>
                ) : (
                  <div className="space-y-4">
                    {userTasks.map((ut) => (
                      <div
                        key={ut.id}
                        className={`p-4 border rounded-lg ${
                          ut.status === 'COMPLETED'
                            ? 'bg-green-50 border-green-300'
                            : isTaskOverdue(ut.task_deadline)
                            ? 'bg-red-50 border-red-400'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{ut.task_title}</h4>
                              {isTaskOverdue(ut.task_deadline) && (
                                <span className="px-2 py-1 bg-red-500 text-white text-xs rounded">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                            {ut.task_description && (
                              <p className="text-sm text-gray-700 mb-2">{ut.task_description}</p>
                            )}
                            <p className="text-xs text-gray-600">
                              Deadline: {new Date(ut.task_deadline).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded text-sm font-semibold ${
                                ut.status === 'COMPLETED'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}
                            >
                              {ut.status}
                            </span>
                            <button
                              onClick={() => handleToggleTaskStatus(ut.id, ut.status)}
                              className={`px-3 py-1 rounded text-sm font-semibold ${
                                ut.status === 'COMPLETED'
                                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                  : 'bg-green-500 hover:bg-green-600 text-white'
                              }`}
                            >
                              {ut.status === 'COMPLETED' ? 'Mark Incomplete' : 'Mark Complete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pending Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">All Pending Tasks</h2>
              <button
                onClick={() => loadPendingTasks()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
            {pendingTasks.length === 0 ? (
              <div className="text-gray-500">
                <p>No pending tasks.</p>
                {coachId && (
                  <p className="text-sm mt-2 text-gray-400">
                    {usersAnalytics.length === 0 
                      ? 'No users assigned to you yet.' 
                      : 'All assigned tasks are completed.'}
                  </p>
                )}
                {!coachId && (
                  <p className="text-sm mt-2 text-gray-400">
                    Coach profile not found. Please contact admin.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTasks.map((ut) => {
                  const overdue = isTaskOverdue(ut.task_deadline)
                  const daysOverdue = overdue 
                    ? Math.floor((new Date().getTime() - new Date(ut.task_deadline).getTime()) / (1000 * 60 * 60 * 24))
                    : 0
                  
                  return (
                    <div
                      key={ut.id}
                      className={`p-4 border rounded-lg ${
                        overdue
                          ? 'bg-red-50 border-red-400'
                          : 'bg-yellow-50 border-yellow-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{ut.task_title}</h4>
                            {overdue && (
                              <span className="px-2 py-1 bg-red-500 text-white text-xs rounded font-bold">
                                OVERDUE {daysOverdue > 0 ? `(${daysOverdue} day${daysOverdue > 1 ? 's' : ''})` : ''}
                              </span>
                            )}
                          </div>
                          {ut.user_name && (
                            <p className="text-sm text-gray-600 mb-1">
                              <span className="font-semibold">Assigned to:</span> {ut.user_name} ({ut.user_email})
                            </p>
                          )}
                          {ut.task_description && (
                            <p className="text-sm text-gray-700 mb-2">{ut.task_description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>
                              <span className="font-semibold">Deadline:</span> {new Date(ut.task_deadline).toLocaleDateString()} {new Date(ut.task_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {overdue && (
                              <span className="text-red-600 font-semibold">
                                Past Due
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="px-3 py-1 rounded text-sm font-semibold bg-red-600 text-white">
                            INCOMPLETE
                          </span>
                          {ut.user_id && (
                            <button
                              onClick={() => {
                                setViewingUserId(ut.user_id)
                                setActiveTab('analytics')
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              View User Tasks
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* User Tasks Modal */}
        {viewingUserId && (
          <UserTasksModal
            userId={viewingUserId}
            userName={usersAnalytics.find((u) => u.id === viewingUserId)?.name || 'User'}
            userEmail={usersAnalytics.find((u) => u.id === viewingUserId)?.email || ''}
            coachName={coachName}
            onClose={() => {
              setViewingUserId(null)
              setUserTasks([])
            }}
            onTaskUpdate={() => {
              loadCoachData()
              loadPendingTasks()
            }}
          />
        )}

        {/* Task Form Modal */}
        {showTaskForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="relative">
              <button
                onClick={() => setShowTaskForm(false)}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700"
              >
                ×
              </button>
              <TaskForm
                task={null}
                coachId={coachId || 0}
                onSubmit={handleCreateTask}
                onCancel={() => setShowTaskForm(false)}
              />
            </div>
          </div>
        )}

        {/* Bulk Assign Modal */}
        {showBulkAssign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Bulk Assign Task</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Task</label>
                  <select
                    value={selectedTaskId || ''}
                    onChange={(e) =>
                      setSelectedTaskId(e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select a task</option>
                    {allTasks.map((task) => (
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
                          checked={selectedUserIds.length === assignedUsers.length && assignedUsers.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(assignedUsers.map((u) => u.id))
                            } else {
                              setSelectedUserIds([])
                            }
                          }}
                          className="rounded w-5 h-5 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-blue-700">
                          Select All ({selectedUserIds.length} of {assignedUsers.length} selected)
                        </span>
                      </label>
                    </div>
                    {/* Individual User Checkboxes */}
                    {assignedUsers.map((user) => (
                      <label key={user.id} className="flex items-center space-x-2 mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, user.id])
                            } else {
                              setSelectedUserIds(selectedUserIds.filter((id) => id !== user.id))
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
                    onClick={handleBulkAssign}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    Assign Task
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkAssign(false)
                      setSelectedTaskId(null)
                      setSelectedUserIds([])
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
