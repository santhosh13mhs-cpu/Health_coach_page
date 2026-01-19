import fs from 'fs';
import path from 'path';

const distPath = path.join(process.cwd(), 'dist', 'server.js');

console.log('🔍 Checking build output...');
console.log('Current directory:', process.cwd());

if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: dist/server.js not found at:', distPath);
  
  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    console.error('Files in dist:', fs.readdirSync(distDir));
  } else {
    console.error('❌ dist folder does not exist');
  }
  
  process.exit(1);
} else {
  console.log('✅ Build successful: dist/server.js exists');
  console.log('📁 File path:', distPath);
}
