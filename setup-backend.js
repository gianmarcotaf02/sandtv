#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 SandTV Backend Setup Script\n');

const backendType = process.argv[2] || 'nodejs';

if (backendType === 'nodejs') {
  console.log('📦 Setting up Node.js/Express backend...\n');

  // Create backend directory
  if (!fs.existsSync('backend')) {
    fs.mkdirSync('backend');
  }

  // Create package.json
  const packageJson = {
    name: 'sandtv-backend',
    version: '1.0.0',
    description: 'Backend proxy for SandTV IPTV Player',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      dev: 'nodemon server.js',
    },
    dependencies: {
      express: '^4.18.2',
      cors: '^2.8.5',
      'node-fetch': '^2.7.0',
      compression: '^1.7.4',
      dotenv: '^16.3.1',
      helmet: '^7.1.0',
      'express-rate-limit': '^7.1.5',
    },
    devDependencies: {
      nodemon: '^3.0.2',
    },
  };

  fs.writeFileSync(
    path.join('backend', 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create .env
  const envContent = `PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development`;

  fs.writeFileSync(path.join('backend', '.env'), envContent);

  console.log('✅ Created backend/package.json');
  console.log('✅ Created backend/.env');
  console.log('\n📥 Installing dependencies...\n');

  // Install dependencies
  try {
    execSync('npm install', {
      cwd: 'backend',
      stdio: 'inherit',
    });

    console.log('\n✅ Dependencies installed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Copy server.js from BACKEND_GUIDE.md to backend/server.js');
    console.log('   2. cd backend');
    console.log('   3. npm run dev');
    console.log('   4. Update App.tsx with backend URL\n');
  } catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
  }
} else if (backendType === 'help') {
  console.log('Usage: node setup-backend.js [nodejs|help]');
  console.log('\nOptions:');
  console.log('  nodejs  - Setup Node.js/Express backend (default)');
  console.log('  help    - Show this help message');
} else {
  console.log(`❌ Unknown backend type: ${backendType}`);
  console.log('Run "node setup-backend.js help" for usage info');
}
