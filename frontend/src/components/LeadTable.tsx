import { useState } from 'react'
import { Lead } from '../types'
import CoachSelector from './CoachSelector'
import { leadsAPI } from '../services/api'
import ViewTasksModal from './ViewTasksModal'

interface LeadTableProps {
  leads: Lead[]
  onAssign: (leadId: number, coachId: number | null) => void
  onBulkAssignSuccess?: (message: string) => void
  onDeleteSuccess?: (message: string) => void
  onRefresh?: () => void
}

export default function LeadTable({ leads, onAssign, onBulkAssignSuccess, onDeleteSuccess, onRefresh }: LeadTableProps) {
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set())
  const [selectedCoach, setSelectedCoach] = useState<number | null>(null)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [viewingTasksForLead, setViewingTasksForLead] = useState<Lead | null>(null)

  const handleSelectLead = (leadId: number) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)))
    }
  }

  const handleBulkAssign = async () => {
    if (selectedLeads.size === 0) {
      alert('Please select at least one lead to assign.')
      return
    }

    // Allow assigning to null (unassigning) or to a coach
    if (selectedCoach === null && !window.confirm('Are you sure you want to unassign the selected leads from their current coaches?')) {
      return
    }

    setBulkAssigning(true)
    try {
      // Use bulk assign API for better performance
      const leadIdsArray = Array.from(selectedLeads)
      const response = await leadsAPI.bulkAssign(leadIdsArray, selectedCoach)
      
      // Show success message if callback provided
      if (onBulkAssignSuccess && response.data.message) {
        onBulkAssignSuccess(response.data.message)
      }
      
      // Reload leads - parent component will handle refresh
      setSelectedLeads(new Set())
      setSelectedCoach(null)
      
      // Trigger parent refresh
      if (onRefresh) {
        onRefresh()
      }
    } catch (error: any) {
      console.error('Bulk assign failed:', error)
      alert(error.response?.data?.error || error.message || 'Failed to assign leads')
    } finally {
      setBulkAssigning(false)
    }
  }

  const handleDelete = async (leadId: number) => {
    if (!window.confirm('Are you sure you want to delete this lead? This will also delete the associated user account if one exists.')) {
      return
    }

    setDeleting(leadId)
    try {
      const response = await leadsAPI.delete(leadId)
      
      if (onDeleteSuccess && response.data.message) {
        onDeleteSuccess(response.data.message)
      }
      
      // Trigger parent refresh
      if (onRefresh) {
        onRefresh()
      }
    } catch (error: any) {
      console.error('Delete failed:', error)
      alert(error.response?.data?.error || error.message || 'Failed to delete lead')
    } finally {
      setDeleting(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return

    if (!window.confirm(`Are you sure you want to delete ${selectedLeads.size} lead(s)? This will also delete associated user accounts if they exist.`)) {
      return
    }

    setBulkDeleting(true)
    try {
      const leadIdsArray = Array.from(selectedLeads)
      const response = await leadsAPI.bulkDelete(leadIdsArray)
      
      if (onDeleteSuccess && response.data.message) {
        onDeleteSuccess(response.data.message)
      }
      
      // Clear selection and refresh
      setSelectedLeads(new Set())
      
      // Trigger parent refresh
      if (onRefresh) {
        onRefresh()
      }
    } catch (error: any) {
      console.error('Bulk delete failed:', error)
      alert(error.response?.data?.error || error.message || 'Failed to delete leads')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Leads ({leads.length})</h2>
        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-3">
            <CoachSelector
              selectedCoachId={selectedCoach}
              onSelect={setSelectedCoach}
              allowNone={true}
            />
            <button
              onClick={handleBulkAssign}
              disabled={bulkAssigning}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {bulkAssigning ? 'Assigning...' : selectedCoach ? `Assign ${selectedLeads.size} Lead(s)` : `Unassign ${selectedLeads.size} Lead(s)`}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedLeads.size} Lead(s)`}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedLeads.size === leads.length && leads.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Assigned Coach
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No leads found. Upload an Excel file to get started.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => handleSelectLead(lead.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm">{lead.name}</td>
                  <td className="px-4 py-3 text-sm">{lead.phone_number}</td>
                  <td className="px-4 py-3 text-sm">{lead.email}</td>
                  <td className="px-4 py-3 text-sm">
                    {lead.coach_name || (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative group">
                        <button
                          onClick={() => {
                            setViewingTasksForLead(lead)
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Lead
                        </button>
                        {/* Dropdown menu */}
                        <div className="absolute left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingTasksForLead(lead)
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                          >
                            View Tasks
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        disabled={deleting === lead.id}
                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 text-sm font-medium"
                      >
                        {deleting === lead.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Tasks Modal */}
      {viewingTasksForLead && (
        <ViewTasksModal
          leadEmail={viewingTasksForLead.email}
          leadName={viewingTasksForLead.name}
          coachName={viewingTasksForLead.coach_name}
          onClose={() => setViewingTasksForLead(null)}
          onTaskComplete={() => {
            // Refresh if needed
            if (onRefresh) {
              onRefresh()
            }
          }}
        />
      )}
    </div>
  )
}
