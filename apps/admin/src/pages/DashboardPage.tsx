import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { 
  Users, Briefcase, CheckCircle, Clock, Star, UserCheck, 
  ArrowUpRight, Plus, MessageCircle, Bell, ShieldCheck, 
  MapPin, RefreshCw, TrendingUp, IndianRupee, Layers
} from 'lucide-react'

interface Stats {
  total_workers:        number
  verified_workers:     number
  pending_workers:      number
  total_customers:      number
  total_jobs:           number
  active_jobs:          number
  completed_jobs:       number
  total_revenue:        number
  services_count:       number
}

interface RecentJob {
  id: string
  status: string
  address: string
  area: string
  price: number | null
  created_at: string
  skills: { name: string; icon: string } | null
  customer: { profiles: { name: string } | null; phone: string } | null
  worker: { profiles: { name: string } | null; phone: string } | null
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  requested:        { label: 'Requested',        color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  pending_dispatch: { label: 'Reviewing',        color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  accepted:         { label: 'Worker Assigned',  color: '#047857', bg: '#d1fae5', border: '#a7f3d0' },
  on_way:           { label: 'On The Way',       color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
  arrived:          { label: 'Arrived',          color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
  working:          { label: 'In Progress',      color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
  completed:        { label: 'Completed',        color: '#047857', bg: '#d1fae5', border: '#a7f3d0' },
  cancelled:        { label: 'Cancelled',        color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
}

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [districtCounts, setDistrictCounts] = useState<{ name: string; count: number; percentage: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadDashboardData() {
    try {
      const [
        workersRes, 
        customersRes, 
        allJobsRes, 
        activeJobsRes, 
        completedJobsRes,
        recentJobsRes,
        skillsRes,
        workerProfilesRes
      ] = await Promise.all([
        supabase.from('users').select('id, worker_profiles(verification_status)', { count: 'exact' }).eq('role', 'worker'),
        supabase.from('users').select('id', { count: 'exact' }).eq('role', 'customer'),
        supabase.from('jobs').select('id, price', { count: 'exact' }),
        supabase.from('jobs').select('id', { count: 'exact' }).in('status', ['requested', 'pending_dispatch', 'accepted', 'on_way', 'arrived', 'working']),
        supabase.from('jobs').select('id', { count: 'exact' }).eq('status', 'completed'),
        supabase.from('jobs').select(`
          id, status, address, area, price, created_at,
          skills (name, icon),
          customer:users!jobs_customer_id_fkey (phone, profiles (name)),
          worker:users!jobs_worker_id_fkey (phone, profiles (name))
        `).order('created_at', { ascending: false }).limit(6),
        supabase.from('skills').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('profiles').select('district, city, users!inner(role)').eq('users.role', 'worker')
      ])

      const workerRows = workersRes.data ?? []
      const verified = workerRows.filter((w: any) => w.worker_profiles?.verification_status === 'verified').length
      const pending = workerRows.filter((w: any) => w.worker_profiles?.verification_status === 'pending').length

      const jobsData = allJobsRes.data ?? []
      const totalRev = jobsData.reduce((acc, j) => acc + (Number(j.price) || 0), 0)

      setStats({
        total_workers:        workersRes.count ?? 0,
        verified_workers:     verified,
        pending_workers:      pending,
        total_customers:      customersRes.count ?? 0,
        total_jobs:           allJobsRes.count ?? 0,
        active_jobs:          activeJobsRes.count ?? 0,
        completed_jobs:       completedJobsRes.count ?? 0,
        total_revenue:        totalRev,
        services_count:       skillsRes.count ?? 10
      })

      setRecentJobs((recentJobsRes.data ?? []) as unknown as RecentJob[])

      // Calculate Regional Distribution
      const distMap: Record<string, number> = {
        'Jammu': 0,
        'Samba': 0,
        'Kathua': 0,
        'Udhampur': 0,
        'Reasi': 0,
        'Doda': 0
      }

      const profs = workerProfilesRes.data ?? []
      profs.forEach((p: any) => {
        const d = p.district || p.city || 'Jammu'
        if (distMap[d] !== undefined) distMap[d]++
        else distMap['Jammu']++
      })

      const totalProfs = Math.max(1, profs.length)
      const distList = Object.entries(distMap).map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalProfs) * 100)
      })).sort((a, b) => b.count - a.count)

      setDistrictCounts(distList)

    } catch (err) {
      console.error('Error loading dashboard stats:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadDashboardData()
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '1rem' }}>
      {/* ── Compact Top Header Banner ─────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
        background: '#ffffff',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Platform Overview
          </h1>
          <span style={{
            background: '#e0e7ff',
            color: '#3730a3',
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.15rem 0.5rem',
            borderRadius: '9999px'
          }}>
            Super Admin
          </span>
          <span style={{ color: '#64748b', fontSize: '0.8rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem' }}>
            Welcome back, <strong>{user?.name || 'Admin'}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.3rem 0.6rem',
            borderRadius: '0.5rem'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Live Sync Active
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Metric Cards Grid (Fixed 4-Columns on 1 row) ─────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '0.875rem',
        marginBottom: '1rem'
      }}>
        {/* Card 1: Workers */}
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          padding: '0.875rem 1rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Verified Workers
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
            {loading ? '…' : stats?.verified_workers ?? 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', paddingTop: '0.4rem', borderTop: '1px solid #f8fafc' }}>
            <span style={{ color: '#64748b' }}>Total: <strong>{stats?.total_workers ?? 0}</strong></span>
            {stats && stats.pending_workers > 0 ? (
              <Link to="/workers?filter=pending" style={{ color: '#d97706', fontWeight: 700, textDecoration: 'none' }}>
                {stats.pending_workers} Pending →
              </Link>
            ) : (
              <span style={{ color: '#10b981', fontWeight: 600 }}>All Verified ✓</span>
            )}
          </div>
        </div>

        {/* Card 2: Active Orders */}
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          padding: '0.875rem 1rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Orders
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#4f46e5', margin: '0.2rem 0' }}>
            {loading ? '…' : stats?.active_jobs ?? 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', paddingTop: '0.4rem', borderTop: '1px solid #f8fafc' }}>
            <span style={{ color: '#64748b' }}>Done: <strong>{stats?.completed_jobs ?? 0}</strong></span>
            <Link to="/jobs?filter=active" style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>
              Live Queue →
            </Link>
          </div>
        </div>

        {/* Card 3: Customers */}
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          padding: '0.875rem 1rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Customers
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#fdf4ff', color: '#c026d3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
            {loading ? '…' : stats?.total_customers ?? 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', paddingTop: '0.4rem', borderTop: '1px solid #f8fafc' }}>
            <span style={{ color: '#64748b' }}>J&K Accounts</span>
            <Link to="/customers" style={{ color: '#c026d3', fontWeight: 700, textDecoration: 'none' }}>
              View Users →
            </Link>
          </div>
        </div>

        {/* Card 4: Total Bookings */}
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          padding: '0.875rem 1rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Bookings
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
            {loading ? '…' : stats?.total_jobs ?? 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', paddingTop: '0.4rem', borderTop: '1px solid #f8fafc' }}>
            <span style={{ color: '#64748b' }}>Volume: <strong>₹{stats?.total_revenue?.toLocaleString('en-IN') ?? 0}</strong></span>
            <Link to="/jobs" style={{ color: '#d97706', fontWeight: 700, textDecoration: 'none' }}>
              All Jobs →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        
        {/* Left Column: Recent Bookings Stream */}
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          padding: '1rem 1.15rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Recent Service Bookings
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.1rem 0 0' }}>
                Latest requests submitted by customers across Jammu & Kashmir
              </p>
            </div>
            <Link to="/jobs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#4f46e5', fontWeight: 700, fontSize: '0.75rem', textDecoration: 'none' }}>
              View All <ArrowUpRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 46, background: '#f8fafc', borderRadius: '0.5rem', opacity: 0.6 }} />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#94a3b8' }}>
              <Briefcase size={28} style={{ margin: '0 auto 0.35rem', opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8rem' }}>No bookings recorded yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentJobs.slice(0, 4).map(job => {
                const st = STATUS_MAP[job.status] || { label: job.status, color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' }
                const shortId = 'MST-' + job.id.replace(/-/g, '').slice(0, 6).toUpperCase()

                return (
                  <div
                    key={job.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.75rem',
                      background: '#f8fafc',
                      borderRadius: '0.5rem',
                      border: '1px solid #e2e8f0',
                      gap: '0.5rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '0.375rem', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', flexShrink: 0 }}>
                        {job.skills?.icon || '🔧'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.skills?.name || 'Service'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {shortId}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📍 {job.area || 'Jammu'} • Cust: {job.customer?.profiles?.name || job.customer?.phone || 'Guest'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.3rem',
                        background: st.bg,
                        color: st.color,
                        border: `1px solid ${st.border}`,
                        marginBottom: '0.15rem'
                      }}>
                        {st.label}
                      </span>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d' }}>
                        ₹{job.price ?? 0}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Regional Coverage & Operations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* District Worker Distribution */}
          <div style={{
            background: '#ffffff',
            borderRadius: '0.75rem',
            padding: '1rem 1.15rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
              <MapPin size={16} style={{ color: '#4f46e5' }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Jammu & Kashmir Regional Coverage
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {districtCounts.map(d => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{d.name} Division</span>
                    <span style={{ color: '#64748b', fontWeight: 500 }}>{d.count} Worker{d.count !== 1 ? 's' : ''} ({d.percentage}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(5, d.percentage)}%`,
                      height: '100%',
                      background: d.percentage > 30 ? 'linear-gradient(90deg, #4f46e5, #6366f1)' : '#93c5fd',
                      borderRadius: 99,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Health & Summary */}
          <div style={{
            background: '#ffffff',
            borderRadius: '0.75rem',
            padding: '0.85rem 1.15rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} style={{ color: '#16a34a' }} />
              Operational Platform Features
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ color: '#64748b' }}>Active Services Catalog</span>
                <strong style={{ color: '#0f172a' }}>{stats?.services_count ?? 10} Disciplines</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ color: '#64748b' }}>Worker Modes</span>
                <strong style={{ color: '#0f172a' }}>Smartphone + Keypad (SMS/Call)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                <span style={{ color: '#64748b' }}>Realtime Presence & Chat</span>
                <strong style={{ color: '#16a34a' }}>🟢 Enabled (Supabase Realtime)</strong>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Quick Operation Launchpad ────────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '0.75rem',
        padding: '0.85rem 1.15rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
      }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.65rem 0' }}>
          ⚡ Admin Action Hub
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '0.75rem'
        }}>
          <Link
            to="/workers/enroll"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textDecoration: 'none',
              color: '#0f172a',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '0.375rem', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Enroll Worker</div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Add Jammu tech</div>
            </div>
          </Link>

          <Link
            to="/jobs"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textDecoration: 'none',
              color: '#0f172a',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '0.375rem', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Briefcase size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dispatch Jobs</div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Manage queue</div>
            </div>
          </Link>

          <Link
            to="/support"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textDecoration: 'none',
              color: '#0f172a',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '0.375rem', background: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Support Inbox</div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Live user chats</div>
            </div>
          </Link>

          <Link
            to="/notifications"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              textDecoration: 'none',
              color: '#0f172a',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '0.375rem', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bell size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Alerts</div>
              <div style={{ color: '#64748b', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Broadcast system</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}


