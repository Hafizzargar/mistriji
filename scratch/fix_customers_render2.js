const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/CustomersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// The file currently has:
//   return (
//     <div>
//       <div className="page-header" ...
//       ...
//       </div>
//
//       if (editingCustomer) {
//         return (
//           ...
//         )
//       }
//       <DataTable ... />
//       ...
//     </div>
//   )

// Let's just find the `if (editingCustomer) {` block and move it before `return (`.

const ifBlockMatch = content.match(/\s*if \(editingCustomer\) \{[\s\S]*?\}\s*(?=<DataTable)/);
if (ifBlockMatch) {
  const ifBlockText = ifBlockMatch[0];
  // Remove it from the current position
  content = content.replace(ifBlockText, '\n\n');
  
  // Insert it before `return (`
  const returnIndex = content.indexOf('  return (\n    <div>');
  if (returnIndex !== -1) {
    content = content.slice(0, returnIndex) + ifBlockText + '\n\n' + content.slice(returnIndex);
  }
}

// Clean up any stray `</div>` tags from the previous replace
// Wait, my previous replace was: 
// content.replace(dataTableRender, dataTableRenderReplacement);
// That replaced `<DataTable ... />` with `if (editingCustomer) { ... } \n <DataTable ... />`
// Which means the `if` block is inside the original `<div> ... </div>` returned by the component.
// We just moved the `if` block out.

// But wait, the previous block might have had other syntax errors.
// Let's check for TS syntax errors.
fs.writeFileSync(file, content, 'utf8');
