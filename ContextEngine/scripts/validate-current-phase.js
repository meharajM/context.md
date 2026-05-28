#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const statusPath = path.join(root, 'implementation', 'status.json');
const phasesPath = path.join(root, 'implementation', 'phases.json');

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const status = readJson(statusPath);
const phases = readJson(phasesPath);
const currentPhase = status.currentPhase;
const phase = phases[currentPhase];

if (!currentPhase || !phase) {
  console.error(`No phase spec found for currentPhase=${currentPhase}`);
  process.exit(1);
}

const commands = Array.isArray(phase.validation) ? phase.validation : [];
if (commands.length === 0) {
  console.error(`No validation commands configured for ${currentPhase}`);
  process.exit(1);
}

console.log(`Validating current phase: ${currentPhase}`);

for (const command of commands) {
  console.log(`\n$ ${command}`);
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
