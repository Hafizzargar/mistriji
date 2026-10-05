const fs = require('fs');
const path = require('path');

const srcPath = path.join('C:', 'Users', 'hafez', 'Desktop', 'jmm', 'mistriji-icon.png');
const resDir = path.join('C:', 'Users', 'hafez', 'Desktop', 'jmm', 'apps', 'web', 'android', 'app', 'src', 'main', 'res');

const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
const iconFiles = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];

if (!fs.existsSync(srcPath)) {
  console.error('Source icon not found:', srcPath);
  process.exit(1);
}

const srcBuffer = fs.readFileSync(srcPath);
console.log('Source icon size:', srcBuffer.length, 'bytes');

mipmaps.forEach(mipmap => {
  const targetFolder = path.join(resDir, mipmap);
  if (fs.existsSync(targetFolder)) {
    iconFiles.forEach(file => {
      const targetPath = path.join(targetFolder, file);
      fs.writeFileSync(targetPath, srcBuffer);
      console.log('Updated:', targetPath);
    });
  }
});

console.log('All launcher icons successfully replaced with MistriJi logo!');
