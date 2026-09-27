const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/CustomersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add ArrowLeft, ShieldCheck, useSearchParams
if (!content.includes('ArrowLeft')) {
  content = content.replace(/import \{([^}]+)\} from 'lucide-react'/, "import { $1, ArrowLeft, ShieldCheck } from 'lucide-react'");
}
if (!content.includes('useSearchParams')) {
  content = content.replace(/import { Link } from 'react-router-dom'/, "import { Link, useSearchParams } from 'react-router-dom'");
}

// Replace showModal state with searchParams
const hookMatch = /const \[showModal, setShowModal\]\s*=\s*useState\(false\)/;
if (content.match(hookMatch)) {
  content = content.replace(hookMatch, `const [searchParams, setSearchParams] = useSearchParams()
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  
  useEffect(() => {
    const viewId = searchParams.get('view')
    if (viewId && customers.length > 0) {
      if (!editingCustomer || editingCustomer.id !== viewId) {
        const toView = customers.find(c => c.id === viewId)
        if (toView) {
          const p = getCustomerProfile(toView)
          setEditingCustomer(toView)
          setName(p?.name ?? '')
          setPhone(toView.phone)
          setEmail(toView.email ?? '')
          setDistrict(p?.district ?? 'Jammu')
          setArea(p?.area ?? 'Gandhi Nagar')
          setPincode(p?.pincode ?? '180004')
          setStatus(toView.status)
          setSuspensionReason(getCustomerSuspensionReason(toView) || '')
          setPhoneCheck({ status: 'idle' })
        }
      }
    } else if (!viewId && editingCustomer) {
      setEditingCustomer(null)
    }
  }, [searchParams, customers])`);
  
  // Remove original editingCustomer definition
  content = content.replace(/const \[editingCustomer, setEditingCustomer\] = useState<Customer \| null>\(null\)\n/g, '');
}

// Modify openEditModal
const oldOpenEditModal = /function openEditModal\(c: Customer\) \{[\s\S]*?setShowModal\(true\)\n  \}/;
if (content.match(oldOpenEditModal)) {
  content = content.replace(oldOpenEditModal, `function openEditModal(c: Customer) {
    setSearchParams({ view: c.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }`);
}

// Modify the view / edit return logic
// Find where it renders the DataTable
const dataTableRender = /<DataTable[\s\S]*?\/>/;
const dataTableRenderReplacement = `
  if (editingCustomer) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease', minHeight: '100vh' }}>
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

  // Original Table view
  $&
`;

content = content.replace(dataTableRender, dataTableRenderReplacement);

// Delete the modal return block entirely
const modalRegex = /\{\/\* Modal \*\/\}\s*\{showModal && \([\s\S]*?\}\)\}\s*/;
content = content.replace(modalRegex, '');

// Fix the scroll lock effect
const scrollLockRegex = /  \/\/ Lock body scroll when modal is open\n  useEffect\(\(\) => \{\n    if \(showModal \|\| deletingCustomer\) \{[\s\S]*?\}\n  \}, \[showModal, deletingCustomer\]\)/;
content = content.replace(scrollLockRegex, `  // Lock body scroll when modal is open
  useEffect(() => {
    if (deletingCustomer) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [deletingCustomer])`);

fs.writeFileSync(file, content, 'utf8');
console.log('Customer refactor done');
