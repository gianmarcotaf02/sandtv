#!/usr/bin/env node

/**
 * SCRIPT DI VERIFICA POST-IMPLEMENTAZIONE
 * 
 * Questo script verifica che tutta l'implementazione sia corretta
 * e che i file siano stati creati/modificati correttamente.
 * 
 * Utilizzo: node verify-live-edge.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// File che devono esistere
const REQUIRED_FILES = [
  'lib/liveEdgeManager.ts',
  'lib/liveEdgeDebug.ts',
  'lib/liveEdgeExamples.ts',
  'hooks/useLiveEdgeDebugging.ts',
  'LIVE_EDGE_SUMMARY.md',
  'LIVE_EDGE_IMPLEMENTATION.md',
  'LIVE_EDGE_TEST_GUIDE.md',
  'README_LIVE_EDGE.md',
];

// String che devono essere presenti in certi file
const REQUIRED_IMPORTS = {
  'components/Player.tsx': [
    "import { getLiveEdgeManager",
    "liveEdgeManagerRef.current",
  ],
  'App.tsx': [
    "import { useLiveEdgeDebugging }",
    "useLiveEdgeDebugging",
  ],
};

const REQUIRED_EXPORTS = {
  'lib/liveEdgeManager.ts': [
    'export class LiveEdgeManager',
    'export interface LiveEdgeDiagnostics',
    'export function getLiveEdgeManager',
  ],
  'lib/liveEdgeDebug.ts': [
    'export function setupLiveEdgeDebugging',
    'export function validateLiveEdgeSetup',
  ],
};

console.log('🔍 VERIFICA IMPLEMENTAZIONE "TORNA AL LIVE"\n');

let allGood = true;

// 1. Verificare file creati
console.log('📁 Verificando file creati...');
REQUIRED_FILES.forEach(file => {
  const filePath = path.join(ROOT, file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    console.log(`  ✅ ${file} (${size} bytes)`);
  } else {
    console.log(`  ❌ ${file} - NON TROVATO`);
    allGood = false;
  }
});

// 2. Verificare import in file modificati
console.log('\n📝 Verificando import in file modificati...');
Object.entries(REQUIRED_IMPORTS).forEach(([file, imports]) => {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ ${file} - NON TROVATO`);
    allGood = false;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  let fileGood = true;

  imports.forEach(importStr => {
    if (content.includes(importStr)) {
      console.log(`  ✅ ${file} - contiene "${importStr}"`);
    } else {
      console.log(`  ❌ ${file} - NON contiene "${importStr}"`);
      fileGood = false;
      allGood = false;
    }
  });
});

// 3. Verificare export nei file creati
console.log('\n📤 Verificando export...');
Object.entries(REQUIRED_EXPORTS).forEach(([file, exports]) => {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ ${file} - NON TROVATO`);
    allGood = false;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  exports.forEach(exportStr => {
    if (content.includes(exportStr)) {
      console.log(`  ✅ ${file} - esporta ${exportStr.split(' ')[2]}`);
    } else {
      console.log(`  ❌ ${file} - NON esporta ${exportStr}`);
      allGood = false;
    }
  });
});

// 4. Verificare linee di codice
console.log('\n📊 Statistiche file...');
const stats = {};
REQUIRED_FILES.forEach(file => {
  const filePath = path.join(ROOT, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const hasTypes = content.includes('export interface') || content.includes('export type');
    const hasClasses = content.includes('export class');
    const hasExports = content.includes('export function') || hasClasses || hasTypes;

    console.log(`  📄 ${file}`);
    console.log(`     - Righe: ${lines}`);
    console.log(`     - Export: ${hasExports ? '✅' : '❌'}`);
  }
});

// 5. Verifica integrità della soluzione
console.log('\n🔗 Verificando integrità della soluzione...');

// Controlla che liveEdgeManager esporti le funzioni giuste
const managerContent = fs.readFileSync(
  path.join(ROOT, 'lib/liveEdgeManager.ts'),
  'utf-8'
);
const debugContent = fs.readFileSync(
  path.join(ROOT, 'lib/liveEdgeDebug.ts'),
  'utf-8'
);
const playerContent = fs.readFileSync(
  path.join(ROOT, 'components/Player.tsx'),
  'utf-8'
);

const checks = [
  {
    name: 'LiveEdgeManager definita',
    pass: managerContent.includes('export class LiveEdgeManager'),
  },
  {
    name: 'analyzeLiveState() implementato',
    pass: managerContent.includes('analyzeLiveState('),
  },
  {
    name: 'shouldShowGoToLiveButton() implementato',
    pass: managerContent.includes('shouldShowGoToLiveButton('),
  },
  {
    name: 'seekToLiveEdge() implementato',
    pass: managerContent.includes('seekToLiveEdge('),
  },
  {
    name: 'setupLiveEdgeDebugging() esportato',
    pass: debugContent.includes('export function setupLiveEdgeDebugging'),
  },
  {
    name: 'Player.tsx integrato con manager',
    pass: playerContent.includes('liveEdgeManagerRef.current'),
  },
  {
    name: 'goToLive() reimplemetnato',
    pass: playerContent.includes('const goToLive = async') || playerContent.includes('function goToLive'),
  },
];

checks.forEach(check => {
  console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
  if (!check.pass) allGood = false;
});

// Riepilogo finale
console.log('\n' + '='.repeat(60));
if (allGood) {
  console.log('✅ VERIFICA COMPLETATA CON SUCCESSO!');
  console.log('\nProssimi step:');
  console.log('  1. npm run build');
  console.log('  2. npm run dev');
  console.log('  3. Apri http://localhost:5173');
  console.log('  4. Console: liveEdgeDebug.help()');
} else {
  console.log('❌ ALCUNI CONTROLLI HANNO FALLITO');
  console.log('\nVerifica che i file siano stati creati/modificati correttamente.');
  console.log('Leggi i messaggi di errore sopra.');
  process.exit(1);
}
console.log('='.repeat(60));
