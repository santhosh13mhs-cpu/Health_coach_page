import { motion, AnimatePresence } from 'framer-motion'
import TaskCard from './TaskCard'
import { Task } from '../types'

interface TaskKanbanProps {
  tasks: Task[]
  onStatusChange: (taskId: number, status: 'completed' | 'incomplete') => void
  onEdit?: (task: Task) => void
  onDelete?: (taskId: number) => void
}

export default function TaskKanban({ tasks, onStatusChange, onEdit, onDelete }: TaskKanbanProps) {
  // Group tasks by date (deadline date only)
  const groupedByDate: Record<string, Task[]> = {}

  tasks.forEach((task) => {
    const deadlineDate = new Date(task.deadline).toISOString().split('T')[0]
    if (!groupedByDate[deadlineDate]) {
      groupedByDate[deadlineDate] = []
    }
    groupedByDate[deadlineDate].push(task)
  })

  // Sort dates
  const sortedDates = Object.keys(groupedByDate).sort()

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)

    if (dateOnly.getTime() === today.getTime()) {
      return 'Today'
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500 text-lg">No tasks found. Create your first task!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateString) => {
        const dateTasks = groupedByDate[dateString]
        const completedTasks = dateTasks.filter((t) => t.status === 'completed' || t.status === 'COMPLETED')
        const incompleteTasks = dateTasks.filter((t) => t.status === 'incomplete' || t.status === 'INCOMPLETE')

        return (
          <div key={dateString} className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-300">
              {formatDateHeader(dateString)}
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Incomplete Tasks Column */}
              <div className="space-y-4">
                <div className="bg-red-100 rounded-lg p-3 mb-3">
                  <h4 className="font-semibold text-red-800">
                    Incomplete ({incompleteTasks.length})
                  </h4>
                </div>
                <AnimatePresence>
                  {incompleteTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={onStatusChange}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </AnimatePresence>
                {incompleteTasks.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg text-gray-500">
                    No incomplete tasks
                  </div>
                )}
              </div>

              {/* Completed Tasks Column */}
              <div className="space-y-4">
                <div className="bg-green-100 rounded-lg p-3 mb-3">
                  <h4 className="font-semibold text-green-800">
                    Completed ({completedTasks.length})
                  </h4>
                </div>
                <AnimatePresence>
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={onStatusChange}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </AnimatePresence>
                {completedTasks.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg text-gray-500">
                    No completed tasks
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
