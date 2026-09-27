const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/WorkersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the Actions column in the table
const actionsColRegex = /key:\s*'actions',[\s\S]*?render:\s*w\s*=>\s*\{[\s\S]*?return\s*\([\s\S]*?<div style=\{\{\s*display:\s*'flex',[^}]*\}\}>([\s\S]*?)<\/div>\s*\)\s*\}\s*\}/;

const newActionsCol = `key: 'actions',
      header: 'Actions',
      sortable: false,
      render: w => {
        return (
          <button className="btn btn-sm btn-primary" onClick={() => openEditModal(w)} title="View & Edit Worker Details">
            <Eye size={14} /> View Details
          </button>
        )
      }
    }`;

content = content.replace(actionsColRegex, newActionsCol);

// 2. Replace the main return block to handle Master-Detail view
// Find where the main return starts: "return (" followed by "<div>" and "<div className=\"page-header\">"
// We'll replace it with a conditional return.

const mainReturnRegex = /return\s*\(\s*<div>\s*<div className="page-header">[\s\S]*?(?=\nexport function|\n$)/;

// Wait, the main return goes all the way to the end of the component.
// It's better to just slice it from `return (` and replace it.

const startIdx = content.indexOf('return (\n    <div>\n      <div className="page-header">');
if (startIdx === -1) {
  console.log("Could not find start of return block");
  process.exit(1);
}

const tableBlock = content.slice(startIdx);

// We need to build the Detail View UI
const detailViewUI = `
  if (editingWorker) {
    return (
      <div style={{ paddingBottom: '3rem', animation: 'fadeIn 0.2s ease' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setEditingWorker(null)} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h1 className="page-title">Worker Profile</h1>
            <p className="page-subtitle">Manage details, history, and status for {editName}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Edit Form */}
          <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Edit Details
              </h3>
            </div>
            
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {editError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                  {editError}
                </div>
              )}

              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required placeholder="e.g. Ramesh Sharma" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">Mobile Number *</label>
                  <input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value)} required placeholder="98xxxxxxxx" />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" className="input" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="worker@email.com" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">District *</label>
                  <select
                    className="input"
                    value={editDistrict}
                    onChange={e => {
                      const nextDistrict = e.target.value
                      setEditDistrict(nextDistrict)
                      const nextAreas = getAreasForDistrict(nextDistrict)
                      const nextArea = nextAreas[0] || editArea
                      setEditArea(nextArea)
                      setEditPincode(JAMMU_AREAS[nextArea]?.pincode || '')
                    }}
                  >
                    {JAMMU_DISTRICT_OPTIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Area *</label>
                  <select
                    className="input"
                    value={editArea}
                    onChange={e => {
                      const nextArea = e.target.value
                      setEditArea(nextArea)
                      setEditPincode(JAMMU_AREAS[nextArea]?.pincode || '')
                    }}
                  >
                    {getAreasForDistrict(editDistrict).map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" value={editPincode} onChange={e => setEditPincode(e.target.value)} placeholder="180004" />
                </div>
                <div>
                  <label className="label">Experience (Years)</label>
                  <input type="number" min={0} max={50} className="input" value={editExp} onChange={e => setEditExp(Number(e.target.value))} />
                </div>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🔧 Assigned Services / Skills
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {availableSkills.map(s => {
                    const isSelected = editSkills.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setEditSkills(prev => 
                            isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          )
                        }}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '2rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          border: \`1px solid \${isSelected ? '#4f46e5' : '#cbd5e1'}\`,
                          background: isSelected ? '#eef2ff' : '#ffffff',
                          color: isSelected ? '#4f46e5' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>{s.icon}</span> {s.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.875rem 1rem', borderRadius: '0.625rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  💰 Custom Pricing / Dihaadi Rate
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.875rem' }}>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Rate / Amount</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>₹</span>
                      <input type="number" min="0" className="input" value={editPriceValue} onChange={e => setEditPriceValue(Number(e.target.value))} style={{ flex: 1 }} />
                    </div>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: '0.75rem' }}>Pricing Unit</label>
                    <select className="input" value={editPriceUnit} onChange={e => setEditPriceUnit(e.target.value as any)}>
                      <option value="day">Per Day (Dihaadi)</option>
                      <option value="sqft">Per Sq. Ft.</option>
                      <option value="meter">Per Meter</option>
                      <option value="foot">Per Foot</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="label">Verification Status</label>
                  <select className="input" value={editStatus} onChange={e => setEditStatus(e.target.value as any)}>
                    <option value="pending">⏳ Pending Verification</option>
                    <option value="verified">✓ Verified & Approved</option>
                    <option value="rejected">✗ Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="label">Phone Type</label>
                  <select className="input" value={editPhoneType} onChange={e => setEditPhoneType(e.target.value as any)}>
                    <option value="smartphone">📱 Smartphone</option>
                    <option value="keypad">🔢 Keypad Phone</option>
                    <option value="none">❌ No Phone</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Actions & History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Account Status Card */}
            <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Account Actions
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: editAccountStatus === 'active' ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', border: \`1px solid \${editAccountStatus === 'active' ? '#bbf7d0' : '#fecaca'}\` }}>
                  <div>
                    <div style={{ fontWeight: 700, color: editAccountStatus === 'active' ? '#15803d' : '#dc2626' }}>
                      {editAccountStatus === 'active' ? 'Account Active' : 'Account Suspended'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.2rem' }}>
                      {editAccountStatus === 'active' ? 'Worker is visible to customers' : 'Worker cannot login or receive jobs'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const newStatus = editAccountStatus === 'active' ? 'suspended' : 'active'
                      setEditAccountStatus(newStatus)
                      // Also auto-save it immediately for convenience
                      supabase.from('users').update({ status: newStatus }).eq('id', editingWorker.id).then(() => {
                        toast.success(newStatus === 'active' ? 'Worker enabled' : 'Worker suspended')
                        fetchWorkers()
                      })
                    }}
                    className={\`btn btn-sm \${editAccountStatus === 'active' ? 'btn-danger' : 'btn-success'}\`}
                  >
                    {editAccountStatus === 'active' ? <><Ban size={14} /> Suspend Worker</> : <><CheckCircle size={14} /> Enable Worker</>}
                  </button>
                </div>
                
                {editAccountStatus === 'suspended' && (
                  <div>
                    <label className="label">Suspension Reason (Visible to Worker)</label>
                    <input className="input" value={editSuspensionReason} onChange={e => setEditSuspensionReason(e.target.value)} placeholder="e.g. Multiple customer complaints" />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#334155' }}>Delete Account</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.2rem' }}>Permanently remove this worker</div>
                  </div>
                  <button onClick={() => setDeletingWorker(editingWorker)} className="btn btn-sm btn-danger">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>

            {/* History Card */}
            <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Briefcase size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                  Work History & Reviews
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Total Jobs</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                    {editingWorker.worker_jobs?.length ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Completed</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                    {editingWorker.worker_jobs?.filter(j => j.status === 'completed').length ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Reviews</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                    {editingWorker.received_ratings?.length ?? 0}
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0.5rem 0 0.5rem 0', color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>
                Past Jobs History
              </h4>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {(editingWorker.worker_jobs?.length ?? 0) === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                    No job history recorded yet.
                  </div>
                ) : (
                  editingWorker.worker_jobs.map(j => (
                    <div key={j.id} style={{
                      padding: '0.625rem 0.875rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#fff',
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.825rem', color: '#0f172a' }}>
                          {j.skills?.icon} {j.skills?.name || 'Service Work'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
                          📍 {j.area} • Customer: {j.customer?.profiles?.name || j.customer?.phone || 'Guest'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#15803d', fontSize: '0.825rem' }}>₹{j.price ?? 0}</div>
                        <span className={\`badge \${j.status === 'completed' ? 'badge-success' : 'badge-neutral'}\`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          {j.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <h4 style={{ margin: '0.75rem 0 0.5rem 0', color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>
                Customer Feedback
              </h4>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(editingWorker.received_ratings?.length ?? 0) === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                    No customer ratings yet.
                  </div>
                ) : (
                  editingWorker.received_ratings.map((r, idx) => (
                    <div key={idx} style={{ padding: '0.55rem 0.75rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: '#b45309' }}>{'⭐'.repeat(r.score)} ({r.score} / 5)</div>
                      <div style={{ color: '#78350f', marginTop: '0.15rem' }}>"{r.comment || 'Great service!'}"</div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // DataTable view
  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Workers Management</h1>
          <p className="page-subtitle">Track ratings, work history, verification, and enable/disable worker accounts</p>
        </div>
        <Link to="/workers/enroll" className="btn btn-primary">
          <PlusCircle size={16} /> Enroll Worker
        </Link>
      </div>

      <DataTable
        data={workers}
        columns={columns}
        loading={loading}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search workers by name, phone, or email..."
        defaultPageSize={10}
        emptyMessage="No workers found"
        emptyIcon="👷"
        toolbarActions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--gray-100)', padding: '0.25rem', borderRadius: '0.5rem' }}>
              {(['all', 'pending', 'verified', 'rejected', 'disabled'] as const).map(f => (
                <button
                key={f}
                onClick={() => setFilter(f)}
                className={\`btn btn-sm \${filter === f ? 'btn-primary' : 'btn-secondary'}\`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => fetchWorkers(currentPage, pageSize, filter)} title="Refresh list">
              <RefreshCw size={14} />
            </button>
          </div>
        }
        serverPagination={{
          totalCount: totalWorkers,
          currentPage,
          pageSize,
          onPageChange: (page) => setCurrentPage(page),
          onPageSizeChange: (size) => {
            setPageSize(size)
            setCurrentPage(1)
          },
        }}
      />

      {/* Delete Modal State */}
      {deletingWorker && (
        <div style={modalStyles.overlay} onClick={() => setDeletingWorker(null)}>
          <div style={modalStyles.card} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Delete Worker</h3>
              <button onClick={() => setDeletingWorker(null)} style={modalStyles.closeBtn}><X size={18} /></button>
            </div>
            <div style={modalStyles.body}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                Are you sure you want to delete worker <strong>{deletingWorker.profiles?.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div style={modalStyles.footer}>
              <button className="btn btn-secondary" onClick={() => setDeletingWorker(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteWorker} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Worker'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
`;

content = content.replace(tableBlock, detailViewUI);

// Fix import for ArrowLeft, ShieldCheck etc if missing
if (!content.includes('ArrowLeft')) {
  content = content.replace(/import {([^}]*)} from 'lucide-react'/, "import { $1, ArrowLeft, ShieldCheck } from 'lucide-react'");
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated WorkersPage.tsx');
