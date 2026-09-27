const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/WorkersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add useSearchParams to import
content = content.replace(/import { Link } from 'react-router-dom'/, "import { Link, useSearchParams } from 'react-router-dom'");

// 2. Add searchParams hook
if (!content.includes('const [searchParams, setSearchParams] = useSearchParams()')) {
  content = content.replace(/const \[workers, setWorkers\] = useState<Worker\[\]>\(\[\]\)/, "const [searchParams, setSearchParams] = useSearchParams()\n  const [workers, setWorkers] = useState<Worker[]>([])");
}

// 3. Sync searchParams with editingWorker
// When editingWorker changes, we should update URL.
// But wait, the better way is: URL drives the state.
// If searchParams.get('view') exists, and we have workers, find it.
const useEffectReplacement = `
  // Sync URL view param to editingWorker
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && workers.length > 0 && !editingWorker) {
      const workerToView = workers.find(w => w.id === viewId);
      if (workerToView) {
        openEditModal(workerToView);
        // Ensure scroll to top when opening details
        window.scrollTo(0, 0);
      }
    } else if (!viewId && editingWorker) {
      setEditingWorker(null);
    }
  }, [searchParams, workers]);
`;

// Wait, if we use `openEditModal` inside `useEffect`, it will set `editingWorker`, which is fine.
// But we also need to change `openEditModal` and the `Back` button to update the URL instead of just state.

// Find openEditModal
content = content.replace(/function openEditModal\(w: Worker\) \{/g, `function openEditModal(w: Worker) {
    if (searchParams.get('view') !== w.id) {
      setSearchParams({ view: w.id });
      // The useEffect will handle the actual opening, but we can also do it directly for speed.
    }`);

// For the Back button:
content = content.replace(/<button className="btn btn-secondary" onClick=\{\(\) => setEditingWorker\(null\)\}/g, `<button className="btn btn-secondary" onClick={() => { setEditingWorker(null); setSearchParams({}); }}`);

// Actually, let's just make openEditModal update URL AND state, and the Back button clear URL and state.
// We also need to add the useEffect to handle direct page loads with ?view=xxx.

// Let's write a robust replacement for the hook area.
const hookAreaMatch = /const \[editingWorker, setEditingWorker\] = useState<Worker \| null>\(null\)/;
const hookAreaReplacement = `const [editingWorker, setEditingWorker] = useState<Worker | null>(null)

  useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && workers.length > 0) {
      if (!editingWorker || editingWorker.id !== viewId) {
        const workerToView = workers.find(w => w.id === viewId);
        if (workerToView) {
          // Manually trigger the edit modal prep
          setEditingWorker(workerToView)
          setEditName(workerToView.profiles?.name || '')
          setEditPhone(workerToView.phone || '')
          setEditEmail(workerToView.email || '')
          setEditExp(workerToView.worker_profiles?.experience_years || 0)
          setEditStatus(workerToView.worker_profiles?.verification_status || 'pending')
          setEditAccountStatus(workerToView.status || 'active')
          setEditSuspensionReason(getWorkerSuspensionReason(workerToView))
          setEditPhoneType(workerToView.worker_profiles?.phone_type || 'smartphone')
          
          const profileArea = workerToView.profiles?.area || ''
          const dist = JAMMU_DISTRICT_OPTIONS.find(d => getAreasForDistrict(d).includes(profileArea)) || 'Jammu'
          setEditDistrict(dist)
          setEditArea(profileArea)
          setEditPincode(JAMMU_AREAS[profileArea]?.pincode || '')

          const assignedSkillIds = workerToView.worker_skills.map(ws => ws.skill_id).filter(Boolean) as string[]
          setEditSkills(assignedSkillIds)
        }
      }
    } else if (!viewId && editingWorker) {
      setEditingWorker(null);
    }
  }, [searchParams.get('view'), workers.length]);
`;

if (!content.includes('searchParams.get(\'view\')')) {
  content = content.replace(hookAreaMatch, hookAreaReplacement);
}

// Modify openEditModal to just update searchParams
const oldOpenEditModal = /function openEditModal\(w: Worker\) \{[\s\S]*?setEditSkills\(assignedSkillIds\)\n  \}/;
const newOpenEditModal = `function openEditModal(w: Worker) {
    setSearchParams({ view: w.id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }`;

if (content.match(oldOpenEditModal)) {
  content = content.replace(oldOpenEditModal, newOpenEditModal);
} else {
  // If we can't find it exactly, let's just forcefully replace the onClick in the table
  content = content.replace(/onClick=\{\(\) => openEditModal\(w\)\}/g, "onClick={() => { setSearchParams({ view: w.id }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}");
}

fs.writeFileSync(file, content, 'utf8');
console.log('Done URL fix');
