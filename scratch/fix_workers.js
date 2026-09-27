const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/WorkersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('ArrowLeft')) {
  content = content.replace(/import {([^}]*)} from 'lucide-react'/, "import { $1, ArrowLeft, ShieldCheck } from 'lucide-react'");
}

const modalStylesStr = `
const modalStyles = {
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    padding: '1rem',
  },
  card: {
    background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: 700,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  body: {
    padding: '1.5rem', overflowY: 'auto' as const, flex: 1,
  },
  footer: {
    padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
    display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexShrink: 0,
  },
  closeBtn: {
    border: 'none', background: 'transparent', cursor: 'pointer', width: 28, height: 28,
    borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#64748b', transition: 'all 0.15s ease',
  },
}
`;

if (!content.includes('const modalStyles = {')) {
  content += '\n' + modalStylesStr;
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed imports and modalStyles');
