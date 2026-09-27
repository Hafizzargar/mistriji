const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/CustomersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// I will completely replace the content of `return (...)` of CustomersPage.
const startIdx = content.indexOf('  return (\n    <div>\n      <div className="page-header"');
const endIdx = content.indexOf('const modalStyles = {');
if (startIdx !== -1 && endIdx !== -1) {
  // Extract up to the end of the CustomersPage component, which is before `const modalStyles = {`
  
  const correctReturn = `
  if (editingCustomer) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease', minHeight: '100vh', paddingBottom: '3rem' }}>
        {/* Detail Header */}
        <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => { setEditingCustomer(null); setSearchParams({}); }}
            style={{ padding: '0.5rem' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">Customer Profile</h1>
            <p className="page-subtitle">Manage details, history, and status for {name}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Edit Form */}
          <div className="card" style={{ padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.5rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '0.5rem', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit3 size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Edit Details
              </h3>
            </div>
            
            <form onSubmit={saveCustomer}>
              <div className="grid grid-cols-2 gap-4">
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="label">Full Name *</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Mobile Number *</label>
                  <input className="input" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="label">District *</label>
                  <select className="input" value={district} onChange={e => setDistrict(e.target.value)}>
                    {JAMMU_DISTRICT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Area *</label>
                  <select className="input" value={area} onChange={e => handleAreaChange(e.target.value)}>
                    {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" value={pincode} onChange={e => setPincode(e.target.value)} />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Account Status / Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: status === 'active' ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', border: \`1px solid \${status === 'active' ? '#bbf7d0' : '#fecaca'}\` }}>
                  <div>
                    <div style={{ fontWeight: 700, color: status === 'active' ? '#15803d' : '#dc2626' }}>
                      {status === 'active' ? 'Account Active' : 'Account Disabled'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.2rem' }}>
                      {status === 'active' ? 'Customer can login and book jobs' : 'Customer cannot login'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newStatus = status === 'active' ? 'disabled' : 'active'
                      setStatus(newStatus)
                      supabase.from('users').update({ status: newStatus }).eq('id', editingCustomer.id).then(() => {
                        toast.success(newStatus === 'active' ? 'Account enabled' : 'Account disabled')
                        fetchCustomers()
                      })
                    }}
                    className={\`btn btn-sm \${status === 'active' ? 'btn-danger' : 'btn-success'}\`}
                  >
                    {status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
                
                {status === 'disabled' && (
                  <div>
                    <label className="label">Disable Reason</label>
                    <input className="input" value={suspensionReason} onChange={e => setSuspensionReason(e.target.value)} placeholder="e.g. Violation of terms" />
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#334155' }}>Delete Account</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.2rem' }}>Permanently remove customer</div>
                  </div>
                  <button onClick={() => setDeletingCustomer(editingCustomer)} className="btn btn-sm btn-danger">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage registered consumer accounts across Jammu & Kashmir</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleRunTestCustomer}
            disabled={loading || testRunning}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontWeight: 700,
              background: '#f0fdf4',
              borderColor: '#86efac',
              color: '#15803d'
            }}
            title="Auto-create and test a realistic Jammu customer account"
          >
            <Sparkles size={15} style={{ color: '#16a34a' }} />
            <span>{testRunning ? 'Testing...' : '🧪 Test Add Customer'}</span>
          </button>

          <button className="btn btn-secondary" onClick={fetchCustomers} title="Refresh list">
            <RefreshCw size={15} />
          </button>

          <Link
            to="/customers/enroll"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
          >
            <UserPlus size={16} /> Enroll Customer
          </Link>
        </div>
      </div>

      <DataTable
        data={customers}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search customers by name, phone, area..."
        defaultPageSize={10}
        emptyMessage="No customers found"
        emptyIcon="👤"
      />

      {deletingCustomer && (
        <div style={modalStyles.overlay} onClick={() => setDeletingCustomer(null)}>
          <div style={{ ...modalStyles.card, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#991b1b' }}>Delete Customer?</h3>
              </div>
              <button onClick={() => setDeletingCustomer(null)} style={modalStyles.closeBtn}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to delete customer <strong>{deletingCustomer.profiles?.name || deletingCustomer.phone}</strong>?
            </div>
            <div style={modalStyles.footer}>
              <button className="btn btn-secondary" onClick={() => setDeletingCustomer(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
\n`;

  content = content.slice(0, startIdx) + correctReturn + content.slice(endIdx);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed syntax!');
