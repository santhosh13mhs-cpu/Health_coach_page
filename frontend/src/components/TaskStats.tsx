import { TaskStats as TaskStatsType } from '../types'

interface TaskStatsProps {
  stats: TaskStatsType
}

export default function TaskStats({ stats }: TaskStatsProps) {
  const completionPercentage =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-blue-100 rounded-lg p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">Total Tasks</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-blue-200 rounded-full p-3">
            <svg
              className="w-8 h-8 text-blue-700"
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
          </div>
        </div>
      </div>

      <div className="bg-green-100 rounded-lg p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">Completed</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{stats.completed}</p>
          </div>
          <div className="bg-green-200 rounded-full p-3">
            <svg
              className="w-8 h-8 text-green-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-red-100 rounded-lg p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">Incomplete</p>
            <p className="text-3xl font-bold text-red-900 mt-1">{stats.incomplete}</p>
          </div>
          <div className="bg-red-200 rounded-full p-3">
            <svg
              className="w-8 h-8 text-red-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-purple-100 rounded-lg p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-800">Completion Rate</p>
            <p className="text-3xl font-bold text-purple-900 mt-1">{completionPercentage}%</p>
          </div>
          <div className="bg-purple-200 rounded-full p-3">
            <svg
              className="w-8 h-8 text-purple-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
