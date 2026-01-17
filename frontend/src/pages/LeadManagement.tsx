import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ExcelUploader from '../components/ExcelUploader'
import LeadTable from '../components/LeadTable'
import CoachSelector from '../components/CoachSelector'
import { leadsAPI } from '../services/api'
import { Lead } from '../types'

export default function LeadManagement() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadLeads()
  }, [])

  const loadLeads = async () => {
    try {
      setLoading(true)
      const response = await leadsAPI.getAll()
      setLeads(response.data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }

  const handleUploadSuccess = (data: any) => {
    setSuccess(`Successfully imported ${data.imported} leads${data.usersCreated ? ` and created ${data.usersCreated} user accounts` : ''}`)
    loadLeads()
    setTimeout(() => setSuccess(null), 5000)
  }

  const handleBulkAssignSuccess = (message: string) => {
    setSuccess(message)
    loadLeads()
    setTimeout(() => setSuccess(null), 5000)
  }

  const handleDeleteSuccess = (message: string) => {
    setSuccess(message)
    loadLeads()
    setTimeout(() => setSuccess(null), 5000)
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(null), 5000)
  }

  const handleAssign = async (leadId: number, coachId: number | null) => {
    try {
      await leadsAPI.assign(leadId, coachId)
      await loadLeads()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign lead')
      setTimeout(() => setError(null), 5000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <ExcelUploader 
        onUploadSuccess={handleUploadSuccess} 
        onUploadError={handleUploadError}
        allowCoachSelection={true}
      />

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <div className="flex gap-2">
            <button
              onClick={loadLeads}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              title="Refresh data"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Back to Admin
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
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading leads...</p>
          </div>
        ) : (
          <LeadTable 
            leads={leads} 
            onAssign={handleAssign} 
            onBulkAssignSuccess={handleBulkAssignSuccess}
            onDeleteSuccess={handleDeleteSuccess}
            onRefresh={loadLeads}
          />
        )}
      </div>
    </div>
  )
}
