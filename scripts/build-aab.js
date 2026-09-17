import { spawnSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve, join } from 'path';

console.log('========================================');
console.log('📦 SMART KHATA — GOOGLE PLAY AAB BUILD');
console.log('========================================\n');

// 1. Resolve JDK and Android SDK paths
const defaultJavaHome = 'C:\\Users\\user\\AppData\\Local\\Programs\\jdk-21';
const defaultAndroidHome = 'C:\\Users\\user\\AppData\\Local\\Android\\Sdk';

const JAVA_HOME = process.env.JAVA_HOME || (existsSync(defaultJavaHome) ? defaultJavaHome : '');
const ANDROID_HOME = process.env.ANDROID_HOME || (existsSync(defaultAndroidHome) ? defaultAndroidHome : '');

if (JAVA_HOME) {
  process.env.JAVA_HOME = JAVA_HOME;
  const javaBin = join(JAVA_HOME, 'bin');
  process.env.PATH = `${javaBin};${process.env.PATH}`;
  console.log(`✅ JAVA_HOME: ${JAVA_HOME}`);
} else {
  console.warn('⚠️ JAVA_HOME not detected. Relying on system PATH.');
}

if (ANDROID_HOME) {
  process.env.ANDROID_HOME = ANDROID_HOME;
  console.log(`✅ ANDROID_HOME: ${ANDROID_HOME}`);
}

const isWindows = process.platform === 'win32';
const androidDir = resolve(process.cwd(), 'android');
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';

console.log(`\n📦 Executing Gradle Bundle build: ${gradlewCmd} bundleRelease...\n`);

const buildRes = spawnSync(gradlewCmd, ['bundleRelease', '--stacktrace'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (buildRes.status !== 0) {
  console.error('\n❌ Gradle bundle build failed with exit code:', buildRes.status);
  process.exit(buildRes.status || 1);
}

const aabPath = resolve(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');

if (existsSync(aabPath)) {
  const stats = statSync(aabPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log('\n========================================');
  console.log('🎉 SUCCESS! ANDROID APP BUNDLE (AAB) READY');
  console.log('========================================');
  console.log(`📁 File: ${aabPath}`);
  console.log(`📊 Size: ${sizeMb} MB`);
  console.log('📝 Note: Upload this .aab file to Google Play Console (Production or Internal Testing track).\n');
} else {
  console.warn('⚠️ Gradle succeeded, but output AAB was not found at standard path:', aabPath);
}
