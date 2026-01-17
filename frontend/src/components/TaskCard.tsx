import { motion } from 'framer-motion'
import { Task } from '../types'

interface TaskCardProps {
  task: Task
  onStatusChange: (taskId: number, status: 'completed' | 'incomplete') => void
  onEdit?: (task: Task) => void
  onDelete?: (taskId: number) => void
}

export default function TaskCard({ task, onStatusChange, onEdit, onDelete }: TaskCardProps) {
  // Tasks status comes from backend and can be 'completed'/'incomplete' (legacy) or 'COMPLETED' (newer UI).
  const isCompleted = task.status === 'completed' || task.status === 'COMPLETED'
  const deadline = new Date(task.deadline)
  const now = new Date()
  const isOverdue = !isCompleted && deadline < now

  const handleStatusToggle = () => {
    const newStatus = isCompleted ? 'incomplete' : 'completed'
    onStatusChange(task.id, newStatus)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg shadow-md p-4 cursor-pointer transition-all duration-300 ${
        isCompleted
          ? 'bg-green-50 border-2 border-green-300'
          : 'bg-red-50 border-2 border-red-300'
      } ${isOverdue ? 'ring-2 ring-red-500 ring-opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3
          className={`font-semibold text-lg ${
            isCompleted ? 'text-green-800 line-through' : 'text-red-800'
          }`}
        >
          {task.title}
        </h3>
        <button
          onClick={handleStatusToggle}
          className={`ml-2 px-2 py-1 rounded transition-colors duration-200 ${
            isCompleted
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isCompleted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {task.description && (
        <p className={`text-sm mb-3 ${isCompleted ? 'text-green-700' : 'text-red-700'}`}>
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
            Deadline: {formatDate(deadline)}
            {isOverdue && (
              <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 rounded text-xs font-bold">
                OVERDUE
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(task.id)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
