import { useState, useEffect } from 'react'
import { Task } from '../types'

interface TaskFormProps {
  task?: Task | null
  coachId?: number
    onSubmit: (data: {
      title: string
      description?: string | null
      start_date: string
      end_date: string
      deadline: string
      allow_document_upload?: number
      report_type?: string | null
    }) => void
  onCancel: () => void
}

export default function TaskForm({ task, coachId = 0, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [allowDocumentUpload, setAllowDocumentUpload] = useState(false)
  const [reportType, setReportType] = useState<string>('SUGAR_REPORT')

  const formatDateTimeLocal = (date: Date) => {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
  }

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setStartDate(formatDateTimeLocal(new Date(task.start_date || task.created_at)))
      setEndDate(formatDateTimeLocal(new Date(task.end_date || task.deadline)))
      setDeadline(formatDateTimeLocal(new Date(task.deadline)))
      setAllowDocumentUpload(!!task.allow_document_upload)
      setReportType(task.report_type || 'SUGAR_REPORT')
    } else {
      // Set default dates
      const today = new Date()
      today.setHours(9, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 7)

      setStartDate(formatDateTimeLocal(today))
      setEndDate(formatDateTimeLocal(tomorrow))
      setDeadline(formatDateTimeLocal(nextWeek))
      setAllowDocumentUpload(false)
      setReportType('SUGAR_REPORT')
    }
  }, [task])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || !endDate || !deadline) {
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) {
      alert('Start date must be before or equal to end date')
      return
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      deadline: new Date(deadline).toISOString(),
      allow_document_upload: allowDocumentUpload ? 1 : 0,
      report_type: allowDocumentUpload ? reportType : null,
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
      <h2 className="text-xl font-bold mb-4">{task ? 'Edit Task' : 'Create New Task'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task title"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task description (optional)"
          />
        </div>

        <div>
          <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            id="start_date"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            id="end_date"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            min={startDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
            Deadline <span className="text-red-500">*</span>
          </label>
          <input
            id="deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
            min={endDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enable Document Upload for this Task
          </label>
          <div className="flex items-center gap-2">
            <input
              id="allow_document_upload"
              type="checkbox"
              checked={allowDocumentUpload}
              onChange={(e) => setAllowDocumentUpload(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="allow_document_upload" className="text-sm text-gray-700">
              Allow PDF/Image upload & report extraction
            </label>
          </div>
          {allowDocumentUpload && (
            <div className="mt-3">
              <label htmlFor="report_type" className="block text-sm font-medium text-gray-700 mb-1">
                Report Type
              </label>
              <select
                id="report_type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SUGAR_REPORT">Sugar Report</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Upload button will be available in "View Task" modal for tasks with this enabled.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {task ? 'Update Task' : 'Create Task'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
