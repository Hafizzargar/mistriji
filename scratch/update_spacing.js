const fs = require('fs');

let content = fs.readFileSync('apps/web/src/pages/HomePage.tsx', 'utf8');

function replaceRemWithClamp(cssValue) {
  // Matches values like 1.5rem, 0.5rem, etc.
  return cssValue.replace(/([\d.]+)rem/g, (match, p1) => {
    const num = parseFloat(p1);
    if (num === 0) return '0';
    const dvh = (num * 1.5).toFixed(2); // slightly less scaling for spacing to avoid shrinking too much
    // min size 2px for very small margins, max is the original rem
    return `clamp(2px, ${dvh}dvh, ${num}rem)`;
  });
}

// 1. Process CSS properties (padding, margin, gap, top, bottom, etc)
// Match something like "padding: 1.5rem 2rem;"
const cssPropsRegex = /(padding|margin|gap|top|bottom|left|right):\s*([^;]+);/g;
content = content.replace(cssPropsRegex, (match, prop, val) => {
  if (val.includes('rem')) {
    return `${prop}: ${replaceRemWithClamp(val)};`;
  }
  return match;
});

// 2. Process React inline styles
// Match something like padding: '1rem 0' or gap: '0.5rem'
const inlinePropsRegex = /(padding|margin|gap|marginBottom|marginTop|marginLeft|marginRight|paddingBottom|paddingTop|paddingLeft|paddingRight):\s*'([^']+)'/g;
content = content.replace(inlinePropsRegex, (match, prop, val) => {
  if (val.includes('rem')) {
    return `${prop}: '${replaceRemWithClamp(val)}'`;
  }
  return match;
});

// Also replace height if specified in px or rem in CSS, but let's stick to spacing (padding/margin/gap).
// User explicitly said "padding andargin also take vw or vh dvh etc their no const spacing"

fs.writeFileSync('apps/web/src/pages/HomePage.tsx', content);
console.log('Spacing updated successfully');
