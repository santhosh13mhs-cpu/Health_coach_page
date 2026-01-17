/**
 * Calculate task status based on dates and completion status
 * Status logic:
 * - OPEN: current_date < start_date
 * - ON_GOING: start_date ≤ current_date ≤ end_date
 * - PENDING: current_date > end_date AND not completed
 * - COMPLETED: Manually marked as completed (status = 'COMPLETED')
 * - OVERDUE: Task completed after end_date/deadline
 */
export function calculateTaskStatus(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  isCompleted: boolean,
  completedAt?: string | null,
  doneDate?: string | null
): 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED' | 'OVERDUE' {
  // If task is marked as completed, check if it was completed after the deadline
  if (isCompleted) {
    // Check if completed after end_date/deadline
    const completionDate = doneDate || completedAt
    if (completionDate && endDate) {
      try {
        const completion = new Date(completionDate)
        const end = new Date(endDate)
        
        // Normalize dates to compare only dates (ignore time)
        const completionDateOnly = new Date(completion.getFullYear(), completion.getMonth(), completion.getDate())
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())
        
        if (completionDateOnly > endDateOnly) {
          return 'OVERDUE'
        }
      } catch (error) {
        console.error('Error comparing completion date:', error)
      }
    }
    return 'COMPLETED'
  }

  // Handle null or undefined dates
  if (!startDate || !endDate) {
    // If dates are missing, default to PENDING (needs attention)
    return 'PENDING'
  }

  try {
    const now = new Date()
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'PENDING'
    }

    // Normalize dates to compare only dates (ignore time)
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate())

    if (nowDate < startDateOnly) {
      return 'OPEN'
    } else if (nowDate >= startDateOnly && nowDate <= endDateOnly) {
      return 'ON_GOING'
    } else {
      // nowDate > endDateOnly
      return 'PENDING'
    }
  } catch (error) {
    console.error('Error calculating task status:', error)
    // Default to PENDING if there's an error
    return 'PENDING'
  }
}

/**
 * Calculate task status for a user task
 */
export function calculateUserTaskStatus(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  userTaskStatus: 'COMPLETED' | 'INCOMPLETE',
  completedAt?: string | null,
  doneDate?: string | null
): 'OPEN' | 'ON_GOING' | 'PENDING' | 'COMPLETED' | 'OVERDUE' {
  return calculateTaskStatus(startDate, endDate, userTaskStatus === 'COMPLETED', completedAt, doneDate)
}
