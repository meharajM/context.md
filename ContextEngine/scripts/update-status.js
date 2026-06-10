#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const statusPath = path.join(root, 'implementation', 'status.json');
const phasesPath = path.join(root, 'implementation', 'phases.json');

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

// Simple CLI arg parser
const args = process.argv.slice(2);
const params = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    // Boolean flags or valued args
    if (['clear-blocker', 'advance', 'started', 'partial', 'done', 'blocked-slice', 'help'].includes(key)) {
      params[key] = true;
    } else {
      // valued args
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        params[key] = args[i + 1];
        i++;
      } else {
        params[key] = true;
      }
    }
  }
}

if (params.help || args.length === 0) {
  console.log(`
Usage: node scripts/update-status.js [options]

Options:
  --status <status>       Set the status of the current phase (in_progress, done, validated, blocked, not_started)
  --evidence <message>    Append evidence text (can be combined with --slice and slice flags)
  --slice <number>        Specify slice number for evidence formatting
  --started               Format slice evidence as STARTED (e.g. "STARTED slice N: <evidence>")
  --partial               Format slice evidence as PARTIAL (e.g. "PARTIAL slice N: <evidence> Remaining: <remaining>")
  --done                  Format slice evidence as DONE (e.g. "DONE slice N: <evidence> Validation: <validation>") (default if --slice is set)
  --blocked-slice         Format slice evidence as BLOCKED (e.g. "BLOCKED slice N: <evidence> Evidence: <blocker>")
  --remaining <text>      Use with --partial to specify remaining work
  --validation-msg <text> Use with --done to specify validation method/results
  --slice-blocker <text>  Use with --blocked-slice to specify why the slice is blocked
  --blocker <message>     Set a phase-level blocker message (changes phase status to blocked)
  --clear-blocker         Clear phase-level blocker (sets blocker to null and status to in_progress)
  --advance               Advance current phase to the next phase in phases.json sequence
  --help                  Show this help message
`);
  process.exit(0);
}

// Load configurations
if (!fs.existsSync(statusPath) || !fs.existsSync(phasesPath)) {
  console.error("Error: status.json or phases.json not found in implementation directory.");
  process.exit(1);
}

const statusData = readJson(statusPath);
const phasesData = readJson(phasesPath);

const currentPhaseId = statusData.currentPhase;
const currentPhase = statusData.phases[currentPhaseId];

if (!currentPhaseId || !currentPhase) {
  console.error(`Error: currentPhase "${currentPhaseId}" not found in status.json.`);
  process.exit(1);
}

const today = new Date().toISOString().split('T')[0];
let modified = false;

// 1. Clear blocker
if (params['clear-blocker']) {
  currentPhase.blocker = null;
  currentPhase.status = 'in_progress';
  console.log(`Cleared blocker for phase "${currentPhaseId}". Status set to "in_progress".`);
  modified = true;
}

// 2. Set blocker
if (params.blocker && typeof params.blocker === 'string') {
  currentPhase.blocker = params.blocker;
  currentPhase.status = 'blocked';
  console.log(`Set blocker for phase "${currentPhaseId}": "${params.blocker}". Status set to "blocked".`);
  modified = true;
}

// 3. Set phase status
if (params.status && typeof params.status === 'string') {
  const allowed = statusData.allowedStatuses || ["not_started", "in_progress", "blocked", "done", "validated"];
  if (!allowed.includes(params.status)) {
    console.error(`Error: Invalid status "${params.status}". Allowed statuses: ${allowed.join(', ')}`);
    process.exit(1);
  }
  currentPhase.status = params.status;
  if (params.status === 'validated') {
    currentPhase.completedAt = today;
  }
  console.log(`Set phase "${currentPhaseId}" status to "${params.status}".`);
  modified = true;
}

// 4. Set evidence
if (params.evidence && typeof params.evidence === 'string') {
  let evidenceStr = params.evidence;

  if (params.slice) {
    const sliceNum = params.slice;
    if (params.started) {
      evidenceStr = `STARTED slice ${sliceNum}: ${params.evidence}`;
    } else if (params.partial) {
      const remaining = params.remaining ? ` Remaining: ${params.remaining}` : '';
      evidenceStr = `PARTIAL slice ${sliceNum}: ${params.evidence}${remaining}`;
    } else if (params['blocked-slice']) {
      const bStr = params['slice-blocker'] ? ` Evidence: ${params['slice-blocker']}` : '';
      evidenceStr = `BLOCKED slice ${sliceNum}: ${params.evidence}${bStr}`;
    } else {
      // Default to DONE
      const valStr = params['validation-msg'] ? ` Validation: ${params['validation-msg']}` : '';
      evidenceStr = `DONE slice ${sliceNum}: ${params.evidence}${valStr}`;
    }
  }

  if (!currentPhase.evidence) {
    currentPhase.evidence = [];
  }
  currentPhase.evidence.push(evidenceStr);
  console.log(`Appended evidence to phase "${currentPhaseId}": "${evidenceStr}"`);
  modified = true;
}

// 5. Advance phase
if (params.advance) {
  currentPhase.status = 'validated';
  currentPhase.completedAt = today;
  
  const nextPhaseId = currentPhase.next;
  if (!nextPhaseId) {
    console.log(`Phase "${currentPhaseId}" is the final phase. Cannot advance further.`);
  } else {
    const nextPhase = statusData.phases[nextPhaseId];
    if (!nextPhase) {
      console.error(`Error: Next phase "${nextPhaseId}" is not defined under status.json phases.`);
      process.exit(1);
    }

    // Set next phase in progress
    nextPhase.status = 'in_progress';
    statusData.currentPhase = nextPhaseId;

    // Update smallAgentStartHere
    if (statusData.smallAgentStartHere) {
      statusData.smallAgentStartHere.nextSafePhase = nextPhaseId;
      statusData.smallAgentStartHere.nextSafeSlice = 1;

      const nextPhaseSpec = phasesData[nextPhaseId];
      if (nextPhaseSpec) {
        statusData.smallAgentStartHere.nextSafeSliceSummary = nextPhaseSpec.goal || `Implement ${nextPhaseId}`;
        // Automatically align minimumReadSet if referencing old phase
        if (Array.isArray(statusData.smallAgentStartHere.minimumReadSet)) {
          statusData.smallAgentStartHere.minimumReadSet = statusData.smallAgentStartHere.minimumReadSet.map(item => {
            if (item.includes('phases.json#')) {
              return `implementation/phases.json#${nextPhaseId}`;
            }
            return item;
          });
        }
      }
    }

    console.log(`Successfully advanced project state!`);
    console.log(`- Previous Phase: "${currentPhaseId}" status set to "validated", completedAt to "${today}"`);
    console.log(`- Current Phase: Advanced to "${nextPhaseId}", status set to "in_progress"`);
    modified = true;
  }
}

if (modified) {
  // Update lastUpdated timestamp
  statusData.lastUpdated = today;
  writeJson(statusPath, statusData);
  console.log(`Updated status.json successfully.`);
} else {
  console.log('No updates made. Run with --help to see usage.');
}
