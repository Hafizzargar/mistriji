const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/CustomersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// Find the block starting with `if (editingCustomer) {` up to its closing brace
// The block ends right before `// Original Table view` or `<DataTable`
// Actually, it ends at line 660 with `  }`.
const startIdx = content.indexOf('  if (editingCustomer) {');
const endIdx = content.indexOf('  // Original Table view');

if (startIdx !== -1 && endIdx !== -1) {
  const extractedBlock = content.substring(startIdx, endIdx);
  
  // Remove the block from its current place
  content = content.replace(extractedBlock, '');
  
  // Find the top-level return
  const returnIdx = content.indexOf('  return (\n    <div>\n      <div className="page-header"');
  if (returnIdx !== -1) {
    // Insert the block just before the return
    content = content.slice(0, returnIdx) + extractedBlock + '\n' + content.slice(returnIdx);
  }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed block position');
