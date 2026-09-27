const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../apps/admin/src/pages/CustomersPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// Find the incorrectly placed if block
const badIfBlock = `      </div>

      
  if (editingCustomer) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease', minHeight: '100vh' }}>`;

const correctedIfBlock = `
  if (editingCustomer) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease', minHeight: '100vh', paddingBottom: '3rem' }}>`;

// Remove the bad block
content = content.replace(badIfBlock, correctedIfBlock);

// Also need to fix the return block of the main table
// Original:
//   return (
//     <div>
//       <div className="page-header"...

content = content.replace(/  return \(\n    <div>\n      <div className="page-header"/, `
  if (editingCustomer) {
    // This is handled below!
  }

  return (
    <div>
      <div className="page-header"`);

// Actually, wait, the easiest way is to use regex.
// The file has:
//   return (
//     <div>
//       <div className="page-header"...
// ...
//       </div>
//
//       if (editingCustomer) { ...

// Let's just do a clean string replacement.
fs.writeFileSync(file, content, 'utf8');
