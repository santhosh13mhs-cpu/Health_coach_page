import { useState, useEffect } from 'react'
import { documentsAPI } from '../services/api'
import { ReportData, TaskDocument } from '../types'
import { extractDataFromImage } from '../utils/ocrExtractor'

interface ReportDataViewProps {
  taskId: number
  userTaskId?: number
  onClose: () => void
  onUpdate?: () => void
}

export default function ReportDataView({ taskId, userTaskId, onClose, onUpdate }: ReportDataViewProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [documents, setDocuments] = useState<TaskDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null)
  const [confidenceScores, setConfidenceScores] = useState<{
    [key: string]: number
  }>({})
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([])

  // Form state
  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    gender: '',
    lab_name: '',
    doctor_name: '',
    blood_sugar_fasting: '',
    blood_sugar_pp: '',
    hba1c_value: '',
    total_cholesterol: '',
  })

  useEffect(() => {
    loadData()
  }, [taskId])

  // Refresh data when modal is opened
  useEffect(() => {
    if (taskId) {
      loadData()
    }
  }, [taskId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [reportRes, docsRes] = await Promise.all([
        userTaskId ? documentsAPI.getUserTaskReportData(userTaskId) : documentsAPI.getReportData(taskId),
        userTaskId ? documentsAPI.getUserTaskDocuments(userTaskId) : documentsAPI.getTaskDocuments(taskId),
      ])
      
      if (reportRes.data) {
        setReportData(reportRes.data)
        const loadedFormData = {
          patient_name: reportRes.data.patient_name || '',
          age: reportRes.data.age || '',
          gender: reportRes.data.gender || '',
          lab_name: reportRes.data.lab_name || '',
          doctor_name: reportRes.data.doctor_name || '',
          blood_sugar_fasting: reportRes.data.blood_sugar_fasting || '',
          blood_sugar_pp: reportRes.data.blood_sugar_pp || '',
          hba1c_value: reportRes.data.hba1c_value || '',
          total_cholesterol: (reportRes.data as any).total_cholesterol || '',
        }
        setFormData(loadedFormData)
        
        // Automatically enter edit mode if there's extracted data
        // This makes it easier to see and edit the extracted values
        const hasExtractedData = loadedFormData.patient_name || 
                                 loadedFormData.blood_sugar_fasting || 
                                 loadedFormData.hba1c_value ||
                                 loadedFormData.age
        if (hasExtractedData && !editing) {
          setEditing(true)
        }
      }
      setDocuments(docsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load report data')
      console.error('Error loading report data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      
      await documentsAPI.createOrUpdateReportData(taskId, {
        document_id: reportData?.document_id || documents[0]?.id || null,
        user_task_id: userTaskId || null,
        report_type: 'SUGAR_REPORT',
        ...formData,
      })

      setEditing(false)
      await loadData()
      if (onUpdate) {
        onUpdate()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save report data')
    } finally {
      setSaving(false)
    }
  }

  const handleViewDocument = async (document: TaskDocument) => {
    try {
      const response = await documentsAPI.getDocumentFile(document.id)
      const blob = response.data
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Clean up the URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100)
    } catch (err: any) {
      setError('Failed to open document. Please try again.')
      console.error('Error viewing document:', err)
    }
  }

  const handleDeleteDocument = async (documentId: number) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingDocId(documentId)
      setError(null)
      await documentsAPI.deleteDocument(documentId)
      await loadData()
      if (onUpdate) {
        onUpdate()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete document')
    } finally {
      setDeletingDocId(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading report data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Blood Report Data</h2>
            <p className="text-blue-100 text-sm mt-1">Sugar Report - Task ID: {taskId}</p>
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
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Documents Section */}
          {documents.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Uploaded Documents</h3>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {doc.file_type === 'application/pdf' ? (
                        <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{doc.file_name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(doc.file_size)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(doc.file_type.startsWith('image/') || doc.file_type === 'application/pdf') && (
                        <button
                          onClick={async () => {
                            try {
                              setError(null)
                              setLoading(true)
                              // Fetch the image file
                              const response = await documentsAPI.getDocumentFile(doc.id)
                              const blob = response.data
                              const file = new File([blob], doc.file_name, { type: doc.file_type })
                              
                              // Extract data using OCR
                              const extractedData = await extractDataFromImage(file)
                              
                              // Update form data
                              setFormData({
                                patient_name: extractedData.patient_name || formData.patient_name,
                                age: extractedData.age || formData.age,
                                gender: extractedData.gender || formData.gender,
                                lab_name: extractedData.lab_name || formData.lab_name,
                                doctor_name: extractedData.doctor_name || formData.doctor_name,
                                blood_sugar_fasting: extractedData.blood_sugar_fasting || formData.blood_sugar_fasting,
                                blood_sugar_pp: extractedData.blood_sugar_pp || formData.blood_sugar_pp,
                                hba1c_value: extractedData.hba1c_value || formData.hba1c_value,
                                total_cholesterol: extractedData.total_cholesterol || formData.total_cholesterol,
                              })
                              
                              // Store confidence scores
                              if (extractedData.confidence) {
                                setConfidenceScores(extractedData.confidence as any)
                                const lowConfFields = extractedData.low_confidence_flags || []
                                setLowConfidenceFields(lowConfFields)
                                
                                if (lowConfFields.length > 0) {
                                  setError(`⚠️ Low confidence detected for: ${lowConfFields.map(f => f.replace(/_/g, ' ')).join(', ')}. Please review these fields carefully.`)
                                } else if (extractedData.confidence.overall && extractedData.confidence.overall < 70) {
                                  setError(`⚠️ Overall confidence is ${extractedData.confidence.overall}%. Please review extracted data.`)
                                } else {
                                  setError(null)
                                }
                              }
                              
                              // Auto-save if there's data
                              if (extractedData.patient_name || extractedData.blood_sugar_fasting || extractedData.hba1c_value) {
                                await documentsAPI.createOrUpdateReportData(taskId, {
                                  document_id: doc.id,
                                  user_task_id: userTaskId || null,
                                  report_type: 'SUGAR_REPORT',
                                  ...extractedData,
                                })
                                await loadData()
                              }
                              
                              setEditing(true)
                              setError(null)
                            } catch (err: any) {
                              const errorMessage = err?.message || 'Unknown error'
                              console.error('OCR Error:', err)
                              // Show specific error message for PDF issues
                              if (errorMessage.includes('PDF') || errorMessage.includes('read') || errorMessage.includes('corrupted') || errorMessage.includes('password')) {
                                setError(`Failed to read PDF: ${errorMessage}. Please enter data manually.`)
                              } else {
                                setError('Failed to extract data from image. Please enter manually.')
                              }
                            } finally {
                              setLoading(false)
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                          title="Extract Data from Image"
                        >
                          Extract Data
                        </button>
                      )}
                      <button
                        onClick={() => handleViewDocument(doc)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingDocId === doc.id}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                        title="Delete Document"
                      >
                        {deletingDocId === doc.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Data Form */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Extracted Report Data</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {documents.length > 0 
                    ? 'Review and edit the extracted data from the uploaded document.'
                    : 'Manually enter report data. Upload a document first to view it alongside the data.'}
                </p>
              </div>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  {reportData ? 'Edit' : 'Enter Data'}
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={formData.patient_name}
                      onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Age</label>
                      {confidenceScores.age !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          confidenceScores.age >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : confidenceScores.age >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {confidenceScores.age}% confidence
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        lowConfidenceFields.includes('age')
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Gender</label>
                      {confidenceScores.gender !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          confidenceScores.gender >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : confidenceScores.gender >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {confidenceScores.gender}% confidence
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        lowConfidenceFields.includes('gender')
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Lab Name</label>
                      {confidenceScores.lab_name !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          confidenceScores.lab_name >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : confidenceScores.lab_name >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {confidenceScores.lab_name}% confidence
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.lab_name}
                      onChange={(e) => setFormData({ ...formData, lab_name: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        lowConfidenceFields.includes('lab_name')
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Doctor Name</label>
                      {confidenceScores.doctor_name !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          confidenceScores.doctor_name >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : confidenceScores.doctor_name >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {confidenceScores.doctor_name}% confidence
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.doctor_name}
                      onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        lowConfidenceFields.includes('doctor_name')
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Blood Sugar (Fasting) mg/dl
                      </label>
                      {confidenceScores.blood_sugar_fasting !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          confidenceScores.blood_sugar_fasting >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : confidenceScores.blood_sugar_fasting >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {confidenceScores.blood_sugar_fasting}% confidence
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.blood_sugar_fasting}
                      onChange={(e) => setFormData({ ...formData, blood_sugar_fasting: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        lowConfidenceFields.includes('blood_sugar_fasting')
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Blood Sugar (Post-Prandial/PP) mg/dl
                      </label>
                      {confidenceScores.blood_sugar_pp !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          confidenceScores.blood_sugar_pp >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : confidenceScores.blood_sugar_pp >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {confidenceScores.blood_sugar_pp}% confidence
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.blood_sugar_pp}
                      onChange={(e) => setFormData({ ...formData, blood_sugar_pp: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        lowConfidenceFields.includes('blood_sugar_pp')
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        HbA1c Value %
                      </label>
                      {confidenceScores.hba1c_value !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          confidenceScores.hba1c_value >= 70 
                            ? 'bg-green-100 text-green-700' 
                            : confidenceScores.hba1c_value >= 60
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {confidenceScores.hba1c_value}% confidence
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.hba1c_value}
                      onChange={(e) => setFormData({ ...formData, hba1c_value: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        lowConfidenceFields.includes('hba1c_value')
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false)
                      if (reportData) {
                        setFormData({
                          patient_name: reportData.patient_name || '',
                          age: reportData.age || '',
                          gender: reportData.gender || '',
                          lab_name: reportData.lab_name || '',
                          doctor_name: reportData.doctor_name || '',
                          blood_sugar_fasting: reportData.blood_sugar_fasting || '',
                          blood_sugar_pp: reportData.blood_sugar_pp || '',
                          hba1c_value: reportData.hba1c_value || '',
                          total_cholesterol: (reportData as any).total_cholesterol || '',
                        })
                      }
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-blue-400">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">Field</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white uppercase">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Patient Name</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.patient_name || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Age</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.age || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Gender</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.gender || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Lab Name</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.lab_name || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Doctor Name</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.doctor_name || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Blood Sugar (Fasting) mg/dl</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.blood_sugar_fasting || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Blood Sugar (Post-Prandial/PP) mg/dl</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.blood_sugar_pp || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">HbA1c Value %</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{reportData?.hba1c_value || '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">Total Cholesterol mg/dl</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{(reportData as any)?.total_cholesterol || '-'}</td>
                    </tr>
                  </tbody>
                </table>
            {!reportData && !editing && (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-3">
                  No report data extracted yet.
                </p>
                <button
                  onClick={() => setEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Enter Report Data
                </button>
              </div>
            )}
              </div>
            )}
          </div>
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
    </div>
  )
}
