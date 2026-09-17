import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

console.log('========================================');
console.log('🛡️ SMART KHATA — RELEASE SAFETY GATE AUDIT');
console.log('========================================\n');

const rootDir = process.cwd();
const gradlePath = resolve(rootDir, 'android', 'app', 'build.gradle');
const manifestPath = resolve(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

let allPassed = true;

function assertCheck(condition, name, failMsg) {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
  } else {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   👉 Reason: ${failMsg}`);
    allPassed = false;
  }
}

// 1. Check Application ID
let gradleContent = '';
if (existsSync(gradlePath)) {
  gradleContent = readFileSync(gradlePath, 'utf8');
}
const appIdMatch = gradleContent.match(/applicationId\s+["']([^"']+)["']/);
const currentAppId = appIdMatch ? appIdMatch[1] : '';
assertCheck(
  currentAppId === 'com.smartkhata.app',
  'Application ID Integrity',
  `Expected "com.smartkhata.app", but found "${currentAppId}". The Android package identity must never change.`
);

// 2. Check Version Code & Version Name
const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);
const versionNameMatch = gradleContent.match(/versionName\s+["']([^"']+)["']/);
const currentCode = versionCodeMatch ? parseInt(versionCodeMatch[1], 10) : 0;
const currentVer = versionNameMatch ? versionNameMatch[1] : '';

assertCheck(
  currentCode >= 1,
  'Version Code Validity',
  `versionCode must be a positive integer >= 1 (found: ${currentCode}).`
);

assertCheck(
  Boolean(currentVer && currentVer.includes('.')),
  'Version Name Validity',
  `versionName must be a valid semantic version (found: "${currentVer}").`
);

// 3. Security Audit: Check for tracked keystores and secret files in Git
let gitTrackedFiles = [];
try {
  const stdout = execSync('git ls-files', { encoding: 'utf8' });
  gitTrackedFiles = stdout.split('\n').map((f) => f.trim()).filter(Boolean);
} catch {
  console.warn('⚠️ Git repository inspection skipped (git command failed).');
}

const forbiddenPatterns = [/\.keystore$/i, /\.jks$/i, /^\.env$/i, /^\.env\.local$/i];
const leakedFiles = gitTrackedFiles.filter((file) =>
  forbiddenPatterns.some((pattern) => pattern.test(file))
);

assertCheck(
  leakedFiles.length === 0,
  'Signing Key & Secret Leak Prevention',
  `Found sensitive files tracked in Git: ${leakedFiles.join(', ')}. Keystores and .env files must never be committed!`
);

// 4. Permissions Audit: Least Privilege Verification
let manifestContent = '';
if (existsSync(manifestPath)) {
  manifestContent = readFileSync(manifestPath, 'utf8');
}

const permissionMatches = [...manifestContent.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]);
const allowedPermissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
];

const disallowedPermissions = permissionMatches.filter((perm) => !allowedPermissions.includes(perm));

assertCheck(
  disallowedPermissions.length === 0,
  'Permissions Least Privilege Audit',
  `Found unauthorized native permissions: ${disallowedPermissions.join(', ')}. Smart Khata requires zero camera, storage, SMS, or contacts permissions.`
);

// 5. Toolchain Validation (Java & Android SDK)
const javaHome = process.env.JAVA_HOME || 'C:\\Users\\user\\AppData\\Local\\Programs\\jdk-21';
const androidHome = process.env.ANDROID_HOME || 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk';

assertCheck(
  existsSync(javaHome),
  'JDK 21 Availability',
  `JAVA_HOME path not found at: ${javaHome}`
);

assertCheck(
  existsSync(androidHome),
  'Android SDK Availability',
  `ANDROID_HOME path not found at: ${androidHome}`
);

console.log('\n----------------------------------------');
if (allPassed) {
  console.log('🎉 ALL RELEASE SAFETY CHECKS PASSED!');
  console.log('----------------------------------------\n');
} else {
  console.error('🚨 SAFETY GATE FAILED: Aborting release build.');
  console.error('----------------------------------------\n');
  process.exit(1);
}
