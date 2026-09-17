import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const pkgPath = resolve(rootDir, 'package.json');
const gradlePath = resolve(rootDir, 'android', 'app', 'build.gradle');
const manifestPath = resolve(rootDir, 'android', 'release-manifest.json');

export function bumpVersion(type = 'patch', customVersion = null) {
  if (!existsSync(pkgPath) || !existsSync(gradlePath) || !existsSync(manifestPath)) {
    throw new Error('Required version files missing (package.json, build.gradle, or release-manifest.json).');
  }

  // 1. Read files
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  let gradleContent = readFileSync(gradlePath, 'utf8');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  // 2. Compute new Version Name
  let currentVersion = pkg.version || '1.0.0';
  let nextVersion = customVersion;

  if (!nextVersion) {
    const parts = currentVersion.split('.').map((p) => parseInt(p, 10) || 0);
    while (parts.length < 3) parts.push(0);

    if (type === 'minor') {
      parts[1] += 1;
      parts[2] = 0;
    } else if (type === 'major') {
      parts[0] += 1;
      parts[1] = 0;
      parts[2] = 0;
    } else {
      // default: patch
      parts[2] += 1;
    }
    nextVersion = parts.join('.');
  }

  // 3. Compute new Version Code (Strictly monotonically increasing)
  const previousCode = manifest.currentVersionCode || 1;
  const nextCode = previousCode + 1;

  // 4. Get Current Git Commit Hash
  let gitCommit = 'local';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {}

  console.log(`\n🔼 BUMPING ANDROID VERSION:`);
  console.log(`   versionName: ${currentVersion} -> ${nextVersion}`);
  console.log(`   versionCode: ${previousCode} -> ${nextCode} (+1)`);
  console.log(`   gitCommit:   ${gitCommit}\n`);

  // 5. Update package.json
  pkg.version = nextVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 6. Update android/app/build.gradle
  gradleContent = gradleContent.replace(
    /versionCode\s+\d+/,
    `versionCode ${nextCode}`
  );
  gradleContent = gradleContent.replace(
    /versionName\s+["'][^"']+["']/,
    `versionName "${nextVersion}"`
  );
  writeFileSync(gradlePath, gradleContent, 'utf8');

  // 7. Update android/release-manifest.json
  manifest.currentVersionName = nextVersion;
  manifest.currentVersionCode = nextCode;
  manifest.history.push({
    versionName: nextVersion,
    versionCode: nextCode,
    date: new Date().toISOString(),
    gitCommit,
    notes: `Release v${nextVersion} (Build #${nextCode})`,
  });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return { nextVersion, nextCode, gitCommit };
}

// Allow direct CLI execution: node scripts/bump-version.js [patch|minor|major] [customVersion]
if (process.argv[1]?.endsWith('bump-version.js')) {
  const bumpType = process.argv[2] || 'patch';
  const customVer = process.argv[3] || null;
  bumpVersion(bumpType, customVer);
}
