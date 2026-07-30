#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const write = (relativePath, contents) => fs.writeFileSync(path.join(root, relativePath), contents);
const exists = relativePath => fs.existsSync(path.join(root, relativePath));

const env = name => (process.env[name] || '').trim();
const required = name => {
  const value = env(name);
  if (!value) {
    throw new Error(`Missing ${name}; set it in .env.release.local before running npm run release:apply-metadata.`);
  }
  return value;
};

const optional = name => env(name);
const replaceAll = (text, token, value) => text.split(token).join(value);
const isHttpsUrl = value => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const legalName = required('CONTEXTENGINE_PUBLISHER_LEGAL_NAME');
const supportEmail = required('CONTEXTENGINE_SUPPORT_EMAIL');
const supportUrl = required('CONTEXTENGINE_SUPPORT_URL');
const privacyPolicyUrl = required('CONTEXTENGINE_PRIVACY_POLICY_URL');
const marketingUrl = optional('CONTEXTENGINE_MARKETING_URL');
const availabilityRegions = required('CONTEXTENGINE_AVAILABILITY_REGIONS');
const targetAudience = required('CONTEXTENGINE_TARGET_AUDIENCE');

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
  throw new Error(`CONTEXTENGINE_SUPPORT_EMAIL must look like an email address, got ${supportEmail}`);
}
for (const [name, value] of [
  ['CONTEXTENGINE_SUPPORT_URL', supportUrl],
  ['CONTEXTENGINE_PRIVACY_POLICY_URL', privacyPolicyUrl],
  ['CONTEXTENGINE_MARKETING_URL', marketingUrl],
]) {
  if (value && !isHttpsUrl(value)) {
    throw new Error(`${name} must be an https:// URL when provided, got ${value}`);
  }
}

const updateFile = (relativePath, replacers) => {
  if (!exists(relativePath)) {
    throw new Error(`Missing ${relativePath}`);
  }
  const original = read(relativePath);
  const next = replacers.reduce(
    (contents, { token, value }) => (value ? replaceAll(contents, token, value) : contents),
    original,
  );
  if (next !== original) {
    write(relativePath, next);
  }
  return next;
};

const policy = updateFile('docs/privacy-policy.md', [
  { token: '[PUBLISHER LEGAL NAME REQUIRED]', value: legalName },
  { token: '[SUPPORT EMAIL REQUIRED]', value: supportEmail },
  { token: '[HTTPS URL REQUIRED BEFORE SUBMISSION]', value: privacyPolicyUrl },
]);

const policyPlaceholders = policy.match(/\[[A-Z][A-Z\s/-]+REQUIRED[^\]]*\]/g) ?? [];
if (policyPlaceholders.length > 0) {
  throw new Error(
    `docs/privacy-policy.md still contains placeholders: ${[...new Set(policyPlaceholders)].join(', ')}`,
  );
}

const store = updateFile('docs/store-submission-package.md', [
  { token: '- Publisher/developer legal name: **[REQUIRED]**', value: `- Publisher/developer legal name: **${legalName}**` },
  { token: '- Support email: **[REQUIRED]**', value: `- Support email: **${supportEmail}**` },
  { token: '- Support URL: **[REQUIRED]**', value: `- Support URL: **${supportUrl}**` },
  { token: '- Public privacy-policy URL: **[REQUIRED]**', value: `- Public privacy-policy URL: **${privacyPolicyUrl}**` },
  { token: '- Marketing URL: **[OPTIONAL]**', value: marketingUrl ? `- Marketing URL: **${marketingUrl}**` : null },
  { token: '- Availability/regions: **[REQUIRED]**', value: `- Availability/regions: **${availabilityRegions}**` },
  { token: '- Target audience and minimum intended age: **[REQUIRED]**', value: `- Target audience and minimum intended age: **${targetAudience}**` },
]);

const storePlaceholders = store.match(/\*\*\[(?:REQUIRED|OPTIONAL)\]\*\*/g) ?? [];
const requiredStorePlaceholders = storePlaceholders.filter(token => token === '**[REQUIRED]**');
if (requiredStorePlaceholders.length > 0) {
  throw new Error(
    'docs/store-submission-package.md still contains required placeholders; fill .env.release.local and rerun npm run release:apply-metadata.',
  );
}

console.log('Updated docs/privacy-policy.md and docs/store-submission-package.md from .env.release.local.');
