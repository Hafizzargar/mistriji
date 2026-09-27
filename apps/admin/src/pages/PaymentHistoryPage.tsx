import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { 
  CreditCard, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  IndianRupee,
  RefreshCw,
  ExternalLink
} from 'lucide-react'

type Payment = {
  id: string
  order_id: string
  payment_id: string | null
  amount: number
  currency: string
  status: 'created' | 'captured' | 'failed'
  created_at: string
  user_id: string | null
  job_id: string | null
  profiles?: { name: string, phone: string, email: string } // assuming user_id joins with profiles
}

export function PaymentHistoryPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          profiles (name, phone, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error fetching payments:', error)
      } else {
        setPayments(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      fetchPayments()
    }
  }, [user])

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--gray-500)' }}>
        <p>Access denied. You do not have permission to view this page.</p>
      </div>
    )
  }

  const filteredPayments = payments.filter(p => 
    p.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.payment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.profiles?.phone.includes(searchTerm)
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'captured':
        return <span className="badge badge-success"><CheckCircle2 size={12}/> Success</span>
      case 'failed':
        return <span className="badge badge-error"><XCircle size={12}/> Failed</span>
      default:
        return <span className="badge badge-warning"><Clock size={12}/> Pending</span>
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 1200 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard size={24} style={{ color: 'var(--brand-500)' }} />
            Payment History
          </h1>
          <p className="page-subtitle">Track all Razorpay transactions across the platform.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={fetchPayments} disabled={loading} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-bar" style={{ width: 300 }}>
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by Order ID, Payment ID, Name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', gap: '0.5rem' }}>
            <Filter size={14}/> Filter
          </button>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead style={{ background: '#f8fafc', color: 'var(--gray-600)', borderBottom: '1px solid var(--gray-200)' }}>
              <tr>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Customer</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Order ID</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Payment ID</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
                    No payments found matching your search.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(payment => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid var(--gray-100)', transition: 'background 0.2s', cursor: 'default' }} className="hover-bg-gray-50">
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                      {new Date(payment.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {payment.profiles ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{payment.profiles.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{payment.profiles.phone}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--gray-400)' }}>Unknown Customer</span>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--gray-700)' }}>
                      {payment.order_id}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--gray-700)' }}>
                      {payment.payment_id || '-'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <IndianRupee size={12} /> {payment.amount / 100}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {getStatusBadge(payment.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
