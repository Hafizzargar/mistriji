const fs = require('fs');

let content = fs.readFileSync('apps/web/src/pages/HomePage.tsx', 'utf8');

// Replace font-size: Xrem with font-size: min(Xrem, X*2dvh) in CSS
content = content.replace(/font-size:\s*([\d.]+)rem/g, (match, p1) => {
  const num = parseFloat(p1);
  const dvh = (num * 1.8).toFixed(2); // slightly less than 2 to scale down faster
  return `font-size: clamp(10px, ${dvh}dvh, ${num}rem)`;
});

// Replace fontSize:'Xrem' with fontSize:'clamp(10px, Ydvh, Xrem)' in JSX
content = content.replace(/fontSize:\s*'([\d.]+)rem'/g, (match, p1) => {
  const num = parseFloat(p1);
  const dvh = (num * 1.8).toFixed(2);
  return `fontSize: 'clamp(10px, ${dvh}dvh, ${num}rem)'`;
});

// Also replace line-height if it has rem, but usually it doesn't.
// Let's also do padding and height? The user said "for text size", so font-size is enough.

fs.writeFileSync('apps/web/src/pages/HomePage.tsx', content);
console.log('Fonts updated successfully');
