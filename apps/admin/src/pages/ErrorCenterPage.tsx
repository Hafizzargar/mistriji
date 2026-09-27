import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, AlertCircle, Info, Bug, CheckCircle, Clock, Search, Trash2 } from 'lucide-react'

interface SystemError {
  id: string
  fingerprint: string
  severity: 'critical' | 'high' | 'warning' | 'info' | 'error'
  endpoint: string
  error_message: string
  stack_trace: string | null
  user_id: string | null
  user_role: string | null
  http_status: number | null
  browser_device: string | null
  app_version: string | null
  status: 'open' | 'resolved' | 'ignored'
  occurrences: number
  first_seen: string
  last_seen: string
}

export default function ErrorCenterPage() {
  const [errors, setErrors] = useState<SystemError[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'open' | 'resolved' | 'ignored'>('open')
  const [selectedError, setSelectedError] = useState<SystemError | null>(null)
  
  useEffect(() => {
    fetchErrors()
    
    // Subscribe to real-time new errors
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_errors' },
        (payload) => {
          fetchErrors() // Refresh on any change
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [filterStatus])

  const fetchErrors = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('system_errors')
      .select('*')
      .eq('status', filterStatus)
      .order('last_seen', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Failed to fetch errors:', error)
    } else {
      setErrors(data || [])
    }
    setLoading(false)
  }

  const updateErrorStatus = async (id: string, newStatus: 'open' | 'resolved' | 'ignored') => {
    const { error } = await supabase
      .from('system_errors')
      .update({ status: newStatus })
      .eq('id', id)
      
    if (error) {
      alert('Failed to update status')
    } else {
      setErrors(errors.filter(e => e.id !== id))
      if (selectedError?.id === id) {
        setSelectedError(null)
      }
    }
  }

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-blue-100 text-blue-700 border-blue-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch(severity) {
      case 'critical': return <AlertTriangle size={16} />
      case 'high': return <AlertCircle size={16} />
      case 'warning': return <AlertTriangle size={16} />
      default: return <Info size={16} />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bug className="text-red-600" />
            Error Center
          </h1>
          <p className="text-gray-500 text-sm mt-1">Monitor, triage, and resolve system issues.</p>
        </div>
        
        <div className="flex bg-white rounded-lg p-1 border shadow-sm">
          <button 
            onClick={() => setFilterStatus('open')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${filterStatus === 'open' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Open
          </button>
          <button 
            onClick={() => setFilterStatus('resolved')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${filterStatus === 'resolved' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Resolved
          </button>
          <button 
            onClick={() => setFilterStatus('ignored')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${filterStatus === 'ignored' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Ignored
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Error List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col max-h-[800px]">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Clock size={16} />
            Recent Issues ({errors.length})
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : errors.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No {filterStatus} errors found! 🎉</div>
            ) : (
              <ul className="divide-y">
                {errors.map(err => (
                  <li 
                    key={err.id} 
                    onClick={() => setSelectedError(err)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedError?.id === err.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getSeverityColor(err.severity)}`}>
                        {getSeverityIcon(err.severity)}
                        {err.severity.toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                        {err.occurrences}x
                      </span>
                    </div>
                    <div className="font-semibold text-sm text-gray-900 line-clamp-2 mt-2">
                      {err.error_message}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 truncate flex items-center justify-between">
                      <span>{err.endpoint || 'Unknown endpoint'}</span>
                      <span>{new Date(err.last_seen).toLocaleTimeString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Error Details Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6 flex flex-col h-full min-h-[500px]">
          {selectedError ? (
            <div className="animate-fade-in flex-1">
              <div className="flex items-start justify-between mb-6 pb-6 border-b">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1 ${getSeverityColor(selectedError.severity)}`}>
                      {getSeverityIcon(selectedError.severity)}
                      {selectedError.severity.toUpperCase()}
                    </span>
                    <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      ID: {selectedError.id.split('-')[0]}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mt-2">{selectedError.error_message}</h2>
                </div>
                
                <div className="flex gap-2">
                  {filterStatus !== 'resolved' && (
                    <button 
                      onClick={() => updateErrorStatus(selectedError.id, 'resolved')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
                    >
                      <CheckCircle size={16} /> Mark Resolved
                    </button>
                  )}
                  {filterStatus !== 'ignored' && (
                    <button 
                      onClick={() => updateErrorStatus(selectedError.id, 'ignored')}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300 transition"
                    >
                      Ignore
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Occurrences</div>
                  <div className="text-lg font-bold text-gray-900">{selectedError.occurrences}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Endpoint</div>
                  <div className="text-sm font-bold text-gray-900 truncate" title={selectedError.endpoint}>{selectedError.endpoint || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Last Seen</div>
                  <div className="text-sm font-bold text-gray-900">{new Date(selectedError.last_seen).toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <div className="text-xs text-gray-500 font-semibold mb-1 uppercase">Status Code</div>
                  <div className="text-sm font-bold text-gray-900">{selectedError.http_status || 'N/A'}</div>
                </div>
              </div>

              {selectedError.stack_trace && (
                <div className="mb-6">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Stack Trace</div>
                  <div className="bg-[#1e1e1e] rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                      {selectedError.stack_trace}
                    </pre>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2 border-b pb-2">User Context</div>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500 font-medium">User ID:</span> {selectedError.user_id || 'Anonymous'}</p>
                    <p><span className="text-gray-500 font-medium">Role:</span> {selectedError.user_role || 'N/A'}</p>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2 border-b pb-2">System Context</div>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500 font-medium">Browser/Agent:</span> {selectedError.browser_device || 'Unknown'}</p>
                    <p><span className="text-gray-500 font-medium">Fingerprint:</span> <span className="font-mono text-xs">{selectedError.fingerprint.substring(0, 16)}...</span></p>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Select an error to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
