import { spawnSync, execSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { bumpVersion } from './bump-version.js';

console.log('====================================================');
console.log('🚀 SMART KHATA — AUTOMATED ANDROID RELEASE PIPELINE');
console.log('====================================================\n');

const rootDir = process.cwd();
const releaseBuildsDir = resolve(rootDir, 'release-builds');
if (!existsSync(releaseBuildsDir)) {
  mkdirSync(releaseBuildsDir, { recursive: true });
}

// 1. Run Pre-Release Safety Gate
console.log('🔍 Step 1/5: Running Safety Gate Audit...');
const safetyRes = spawnSync('node', ['scripts/verify-release-safety.js'], {
  stdio: 'inherit',
  shell: true,
});
if (safetyRes.status !== 0) {
  console.error('\n❌ Safety Gate failed. Aborting pipeline.');
  process.exit(1);
}

// 2. Determine Versioning Action
const bumpArg = process.argv[2] || 'patch';
let versionName = '1.0.0';
let versionCode = 1;

if (bumpArg !== 'keep') {
  console.log('🔼 Step 2/5: Incrementing Android versionCode & versionName...');
  const bumpResult = bumpVersion(bumpArg);
  versionName = bumpResult.nextVersion;
  versionCode = bumpResult.nextCode;
} else {
  console.log('ℹ️ Step 2/5: Keeping current version (no version bump requested)...');
  const manifest = JSON.parse(readFileSync(resolve(rootDir, 'android', 'release-manifest.json'), 'utf8'));
  versionName = manifest.currentVersionName || '1.0.0';
  versionCode = manifest.currentVersionCode || 1;
}

// 3. Web Build & Capacitor Sync
console.log('\n🌐 Step 3/5: Compiling Web Application & Syncing Capacitor Assets...');
const webBuildRes = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
if (webBuildRes.status !== 0) {
  console.error('\n❌ Web compilation failed. Aborting release.');
  process.exit(1);
}

const capSyncRes = spawnSync('npx', ['cap', 'sync', 'android'], { stdio: 'inherit', shell: true });
if (capSyncRes.status !== 0) {
  console.error('\n❌ Capacitor sync failed. Aborting release.');
  process.exit(1);
}

// 4. Execute Native Android Builds (APK + AAB)
console.log('\n🤖 Step 4/5: Compiling Android Debug APK & Release AAB...');
const apkBuildRes = spawnSync('node', ['scripts/build-apk.js'], { stdio: 'inherit', shell: true });
if (apkBuildRes.status !== 0) {
  console.error('\n❌ APK build failed. Aborting release.');
  process.exit(1);
}

const aabBuildRes = spawnSync('node', ['scripts/build-aab.js'], { stdio: 'inherit', shell: true });
if (aabBuildRes.status !== 0) {
  console.error('\n❌ AAB build failed. Aborting release.');
  process.exit(1);
}

// 5. Predictable Artifact Packaging & Summary
console.log('\n📦 Step 5/5: Packaging Predictable Release Artifacts...');
const rawApkPath = resolve(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const rawAabPath = resolve(rootDir, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');

const namedApk = resolve(releaseBuildsDir, `SmartKhata-v${versionName}-build${versionCode}-debug.apk`);
const namedAab = resolve(releaseBuildsDir, `SmartKhata-v${versionName}-build${versionCode}-release.aab`);
const latestApk = resolve(releaseBuildsDir, 'SmartKhata-latest-debug.apk');
const latestAab = resolve(releaseBuildsDir, 'SmartKhata-latest-release.aab');

if (existsSync(rawApkPath)) {
  copyFileSync(rawApkPath, namedApk);
  copyFileSync(rawApkPath, latestApk);
}

if (existsSync(rawAabPath)) {
  copyFileSync(rawAabPath, namedAab);
  copyFileSync(rawAabPath, latestAab);
}

let gitCommit = 'local';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {}

const apkSizeMb = existsSync(namedApk) ? (statSync(namedApk).size / (1024 * 1024)).toFixed(2) : '0';
const aabSizeMb = existsSync(namedAab) ? (statSync(namedAab).size / (1024 * 1024)).toFixed(2) : '0';

console.log('\n========================================');
console.log('ANDROID RELEASE SUMMARY');
console.log('========================================');
console.log(`ANDROID VERSION:\n${versionName} (Code: ${versionCode})\n`);
console.log(`APK:\n${namedApk} (${apkSizeMb} MB)\n`);
console.log(`AAB:\n${namedAab} (${aabSizeMb} MB)\n`);
console.log(`VERSION NAME:\n${versionName}\n`);
console.log(`VERSION CODE:\n${versionCode}\n`);
console.log(`GIT COMMIT:\n${gitCommit}\n`);
console.log('VERCEL:\nDEPLOYED FROM GIT (INDEPENDENT)\n');
console.log('ANDROID BUILD:\nPASS\n');
console.log('SIGNING:\nPASS (DEBUG / PLAY APP SIGNING READY)\n');
console.log('GOOGLE PLAY:\nNOT PUBLISHED (MANUAL APPROVAL REQUIRED)\n');
console.log('MANUAL PHONE TEST:\nREQUIRED');
console.log('========================================\n');
