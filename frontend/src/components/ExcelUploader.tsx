import { useState, useRef, useEffect } from 'react'
import { leadsAPI, coachesAPI } from '../services/api'

interface ExcelUploaderProps {
  onUploadSuccess: (data: any) => void
  onUploadError: (error: string) => void
  allowCoachSelection?: boolean
}

export default function ExcelUploader({ onUploadSuccess, onUploadError, allowCoachSelection = false }: ExcelUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null)
  const [coaches, setCoaches] = useState<any[]>([])
  const [showCoachModal, setShowCoachModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (allowCoachSelection) {
      loadCoaches()
    }
  }, [allowCoachSelection])

  // Reload coaches when modal opens
  useEffect(() => {
    if (showCoachModal && allowCoachSelection) {
      loadCoaches()
    }
  }, [showCoachModal, allowCoachSelection])

  const loadCoaches = async () => {
    try {
      const response = await coachesAPI.getAll()
      setCoaches(response.data)
    } catch (error) {
      console.error('Failed to load coaches:', error)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      onUploadError('No file selected. Please select an Excel file.')
      return
    }

    // Validate file type (check both MIME type and extension)
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/excel',
      'application/x-excel',
    ]
    const validExtensions = ['.xlsx', '.xls']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      onUploadError('File too large. Maximum size is 10MB.')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    
    if (!validTypes.includes(file.type) && !hasValidExtension) {
      onUploadError('Invalid file type. Please upload an Excel file (.xlsx or .xls)')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // If coach selection is enabled, show modal first
    if (allowCoachSelection) {
      setPendingFile(file)
      setShowCoachModal(true)
      // Don't clear input value here - keep it for retry
      return
    }

    // Otherwise upload directly
    await uploadFile(file, null)
  }

  const uploadFile = async (file: File, coachId: number | null) => {
    setIsUploading(true)
    try {
      // Check if user has admin role
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        if (user.role !== 'ADMIN') {
          onUploadError('Only administrators can upload leads. Please log in as an admin.')
          setIsUploading(false)
          return
        }
      }
      
      const response = await leadsAPI.upload(file, coachId)
      onUploadSuccess(response.data)
      setShowCoachModal(false)
      setPendingFile(null)
      setSelectedCoachId(null)
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upload file'
      if (error.response?.status === 403) {
        onUploadError('Access denied. You need ADMIN role to upload leads. Current role may not have permission.')
      } else if (error.response?.status === 401) {
        onUploadError('Authentication failed. Please log in again.')
      } else {
        onUploadError(errorMessage)
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConfirmUpload = () => {
    if (!pendingFile) {
      onUploadError('No file selected. Please select a file first.')
      return
    }
    
    // Allow upload even if no coach is selected (coachId can be null)
    uploadFile(pendingFile, selectedCoachId)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <div className="fixed top-4 right-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={handleClick}
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-colors duration-200 flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Upload Excel
            </>
          )}
        </button>
      </div>

      {/* Coach Selection Modal */}
      {showCoachModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Select Coach (Optional)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Choose a coach to assign all leads from this file. You can skip this step.
            </p>
            {coaches.length === 0 ? (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">Loading coaches...</p>
              </div>
            ) : (
              <select
                value={selectedCoachId || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setSelectedCoachId(value && value !== '' ? parseInt(value) : null)
                }}
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 mb-4 focus:border-blue-500 focus:outline-none"
              >
                <option value="">No Coach (Skip Assignment)</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name} ({coach.email})
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleConfirmUpload}
                disabled={isUploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg"
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
              <button
                onClick={() => {
                  setShowCoachModal(false)
                  setPendingFile(null)
                  setSelectedCoachId(null)
                }}
                disabled={isUploading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
