import { useEffect, useState } from 'react'
import { coachesAPI } from '../services/api'

interface Coach {
  id: number
  name: string
  email: string
}

interface CoachSelectorProps {
  selectedCoachId: number | null
  onSelect: (coachId: number | null) => void
  allowNone?: boolean
}

export default function CoachSelector({
  selectedCoachId,
  onSelect,
  allowNone = false,
}: CoachSelectorProps) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCoaches()
  }, [])

  const loadCoaches = async () => {
    try {
      const response = await coachesAPI.getAll()
      setCoaches(response.data)
    } catch (error) {
      console.error('Failed to load coaches:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <select className="border rounded px-3 py-2" disabled>
        <option>Loading coaches...</option>
      </select>
    )
  }

  return (
    <select
      value={selectedCoachId || ''}
      onChange={(e) => onSelect(e.target.value ? parseInt(e.target.value) : null)}
      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {allowNone && <option value="">-- No Coach --</option>}
      {coaches.map((coach) => (
        <option key={coach.id} value={coach.id}>
          {coach.name} ({coach.email})
        </option>
      ))}
    </select>
  )
}
