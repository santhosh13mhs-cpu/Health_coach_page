import { useState, useEffect } from 'react'
import { userTasksAPI, documentsAPI } from '../services/api'
import ReportDataView from './ReportDataView'
import { extractDataFromImage } from '../utils/ocrExtractor'

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
  task_allow_document_upload?: number | null
  task_report_type?: string | null
  coach_name?: string | null
  user_name?: string
  user_email?: string
}

interface UserTasksModalProps {
  userId: number
  userName: string
  userEmail: string
  coachName?: string | null
  onClose: () => void
  onTaskUpdate?: () => void
}

export default function UserTasksModal({
  userId,
  userName,
  userEmail,
  coachName,
  onClose,
  onTaskUpdate,
}: UserTasksModalProps) {
  const [tasks, setTasks] = useState<UserTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null)
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [taskToComplete, setTaskToComplete] = useState<UserTask | null>(null)
  const [remarks, setRemarks] = useState('')
  const [doneDate, setDoneDate] = useState('')
  const [viewingReportData, setViewingReportData] = useState<{ taskId: number; userTaskId: number } | null>(null)
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<number | null>(null)
  const [reportDataRefreshKey, setReportDataRefreshKey] = useState(0)

  useEffect(() => {
    loadTasks()
  }, [userId])

  const handleFileUpload = async (taskId: number, userTaskId: number, file: File) => {
    try {
      setUploadingTaskId(taskId)
      setError(null)
      
      // Upload the document first
      await documentsAPI.upload(taskId, file, userTaskId)
      setUploadSuccess(taskId)
      
      // If it's an image or PDF file, extract data using BLIP + OCR
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        try {
          const fileType = file.type === 'application/pdf' ? 'PDF' : 'image'
          setError(`Extracting data from ${fileType}...`)
          
          const extractedData = await extractDataFromImage(file)
          
          // Check if any data was extracted
          const hasData = extractedData.patient_name || 
                         extractedData.blood_sugar_fasting || 
                         extractedData.hba1c_value ||
                         extractedData.age ||
                         extractedData.lab_name
          
          if (hasData) {
            // Auto-save extracted data
            await documentsAPI.createOrUpdateReportData(taskId, {
              user_task_id: userTaskId,
              report_type: 'SUGAR_REPORT',
              ...extractedData,
            })
            
            setError(`✓ Data extracted successfully from ${fileType}! Opening form...`)
          } else {
            setError(`⚠ No data could be extracted from ${fileType}. Please enter data manually.`)
          }
        } catch (ocrError: any) {
          console.error('OCR Error:', ocrError)
          // Show specific error message if available
          const errorMessage = ocrError?.message || 'Unknown error'
          const fileType = file.type === 'application/pdf' ? 'PDF' : 'image'
          
          if (errorMessage.includes('PDF') || errorMessage.includes('read') || errorMessage.includes('corrupted')) {
            setError(`Document uploaded successfully, but failed to read ${fileType}: ${errorMessage}. You can enter data manually.`)
          } else {
            setError(`Document uploaded successfully, but automatic data extraction from ${fileType} failed. You can enter data manually.`)
          }
        }
      }
      
      // Reload tasks to get updated data
      await loadTasks()
      
      // Auto-open report data view after successful upload
      // Wait a bit longer to ensure data is fully saved and available
      setTimeout(() => {
        setReportDataRefreshKey(prev => prev + 1) // Force refresh
        setViewingReportData({ taskId, userTaskId })
        setUploadSuccess(null)
        // Keep success message briefly visible, then clear
        setTimeout(() => setError(null), 2000)
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload document')
      setUploadingTaskId(null)
    }
  }

  const handleFileSelect = (taskId: number, userTaskId: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.png,.jpg,.jpeg'
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (file) {
        // Validate file type
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
        const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg']
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
        
        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
          setError('Invalid file type. Please upload a PDF or PNG/JPEG image file.')
          return
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError('File size exceeds 10MB limit.')
          return
        }

        handleFileUpload(taskId, userTaskId, file)
      }
    }
    input.click()
  }

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await userTasksAPI.getUserTasks(userId)
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
      setUpdatingTaskId(taskToComplete.id)
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
      if (onTaskUpdate) {
        onTaskUpdate()
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update task status')
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const handleMarkIncomplete = async (taskId: number) => {
    if (!confirm('Are you sure you want to mark this task as incomplete? This will clear the remarks and done date.')) {
      return
    }

    try {
      setUpdatingTaskId(taskId)
      await userTasksAPI.updateStatus(taskId, 'INCOMPLETE' as 'COMPLETED' | 'INCOMPLETE')
      await loadTasks()
      if (onTaskUpdate) {
        onTaskUpdate()
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update task status')
    } finally {
      setUpdatingTaskId(null)
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

  const isTaskOverdue = (deadline: string) => {
    return new Date(deadline) < new Date() && new Date(deadline).toDateString() !== new Date().toDateString()
  }

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
              {coachName || (tasks.length > 0 && tasks[0].coach_name) ? `${userName} (${userEmail})` : userEmail}
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
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    task.status === 'COMPLETED'
                      ? 'bg-green-50 border-green-300'
                      : isTaskOverdue(task.task_deadline)
                      ? 'bg-red-50 border-red-400'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{task.task_title}</h3>
                        {isTaskOverdue(task.task_deadline) && (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded font-bold">
                            OVERDUE
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(
                            task.task_status
                          )}`}
                        >
                          {task.task_status || 'N/A'}
                        </span>
                      </div>
                      {task.task_description && (
                        <p className="text-sm text-gray-700 mb-3">{task.task_description}</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600">
                        <div>
                          <span className="font-semibold">Start Date:</span>{' '}
                          {formatDate(task.task_start_date)}
                        </div>
                        <div>
                          <span className="font-semibold">End Date:</span>{' '}
                          {formatDate(task.task_end_date)}
                        </div>
                        <div>
                          <span className="font-semibold">Deadline:</span>{' '}
                          {formatDate(task.task_deadline)}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {task.task_allow_document_upload ? (
                          <button
                            onClick={() => handleFileSelect(task.task_id, task.id)}
                            disabled={uploadingTaskId === task.task_id}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-semibold py-1 px-3 rounded transition-colors flex items-center gap-1"
                            title="Upload Document (PDF/PNG)"
                          >
                            {uploadingTaskId === task.task_id ? (
                              <>
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Uploading...
                              </>
                            ) : uploadSuccess === task.task_id ? (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Uploaded!
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Upload Document
                              </>
                            )}
                          </button>
                        ) : null}
                        <button
                          onClick={() => setViewingReportData({ taskId: task.task_id, userTaskId: task.id })}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1 px-3 rounded transition-colors"
                        >
                          View Report Data
                        </button>
                      </div>
                      {task.done_date && (
                        <p className="text-xs text-green-600 mt-2 font-semibold">
                          ✓ Done Date: {formatDate(task.done_date)}
                        </p>
                      )}
                      {task.completed_at && (
                        <p className="text-xs text-gray-600 mt-1">
                          Completed At: {formatDate(task.completed_at)}
                        </p>
                      )}
                      {task.remarks && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs font-semibold text-blue-800 mb-1">Remarks:</p>
                          <p className="text-xs text-blue-700">{task.remarks}</p>
                        </div>
                      )}
                      {task.coach_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          Assigned by Coach: {task.coach_name}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <span
                        className={`px-3 py-1 rounded text-sm font-semibold ${
                          task.status === 'COMPLETED'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {task.status}
                      </span>
                      {task.status === 'COMPLETED' ? (
                        <button
                          onClick={() => handleMarkIncomplete(task.id)}
                          disabled={updatingTaskId === task.id}
                          className="px-4 py-2 rounded text-sm font-semibold transition-colors bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {updatingTaskId === task.id ? 'Updating...' : 'Mark Incomplete'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkComplete(task)}
                          disabled={updatingTaskId === task.id}
                          className="px-4 py-2 rounded text-sm font-semibold transition-colors bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
                disabled={!doneDate || updatingTaskId === taskToComplete.id}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {updatingTaskId === taskToComplete.id ? 'Saving...' : 'Mark as Completed'}
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

      {/* Report Data View Modal */}
      {viewingReportData && (
        <ReportDataView
          key={`${viewingReportData.taskId}-${viewingReportData.userTaskId}-${reportDataRefreshKey}`}
          taskId={viewingReportData.taskId}
          userTaskId={viewingReportData.userTaskId}
          onClose={() => {
            setViewingReportData(null)
            setUploadSuccess(null)
          }}
          onUpdate={() => {
            loadTasks()
            if (onTaskUpdate) {
              onTaskUpdate()
            }
          }}
        />
      )}
    </div>
  )
}
