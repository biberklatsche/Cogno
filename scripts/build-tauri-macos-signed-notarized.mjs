import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const appleCredentialsFilePath = join(homedir(), '.apple', 'credentials');

function ensureCredentialValue(credentialValue, credentialName) {
  if (typeof credentialValue !== 'string' || credentialValue.trim().length === 0) {
    throw new Error(`Missing "${credentialName}" in ${appleCredentialsFilePath}.`);
  }
}

async function loadAppleCredentials() {
  const credentialsFileContent = await readFile(appleCredentialsFilePath, 'utf8');
  const parsedCredentials = JSON.parse(credentialsFileContent);

  ensureCredentialValue(parsedCredentials.appleId, 'appleId');
  ensureCredentialValue(parsedCredentials.teamId, 'teamId');
  ensureCredentialValue(parsedCredentials.appleIdPassword, 'appleIdPassword');

  return {
    appleId: parsedCredentials.appleId,
    teamId: parsedCredentials.teamId,
    appleIdPassword: parsedCredentials.appleIdPassword
  };
}

async function run() {
  if (process.platform !== 'darwin') {
    console.log('Skipping notarized macOS build because current platform is not darwin.');
    process.exit(0);
  }

  const appleCredentials = await loadAppleCredentials();

  process.env.APPLE_ID ||= appleCredentials.appleId;
  process.env.APPLE_TEAM_ID ||= appleCredentials.teamId;
  process.env.APPLE_PASSWORD ||= appleCredentials.appleIdPassword;

  await new Promise((resolve, reject) => {
    const tauriBuildProcess = spawn(
      'npx',
      ['tauri', 'build', '--bundles', 'app,dmg'],
      { stdio: 'inherit', env: process.env }
    );

    tauriBuildProcess.on('error', (error) => reject(error));
    tauriBuildProcess.on('exit', (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }
      reject(new Error(`tauri build failed with exit code ${exitCode ?? 'unknown'}.`));
    });
  });
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
