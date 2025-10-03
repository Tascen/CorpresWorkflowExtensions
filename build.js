// build.js
// Запуск: node build.js
const fs = require('fs');
const path = require('path');
const { Parcel } = require('@parcel/core');
require('dotenv').config();



const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');

const ENTRY_EXT_RE = /\.(mjs|js|ts|tsx|jsx)$/i;
const STATIC_EXT_RE = /\.(html?|css|png|jpg|jpeg|gif|svg|ico|json)$/i;


function isLikelyLocalFile(str) {
  if (typeof str !== 'string') return false;
  if (str.includes('://')) return false;
  return ENTRY_EXT_RE.test(str) || STATIC_EXT_RE.test(str);
}

function isScriptFile(str) {
  return ENTRY_EXT_RE.test(str);
}

function isStaticFile(str) {
  return STATIC_EXT_RE.test(str);
}

function normalizeToPosix(p) {
  return p.split(path.sep).join('/');
}

function findFileRecursively(rootDir, targetBasename) {
  const stack = [rootDir];
  while (stack.length) {
    const cur = stack.pop();
    if (!fs.existsSync(cur)) continue;
    const items = fs.readdirSync(cur, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(cur, it.name);
      if (it.isDirectory()) stack.push(full);
      else if (it.isFile() && it.name === targetBasename) return full;
    }
  }
  return null;
}

function collectPathsFromManifest(obj, set) {
  if (typeof obj === 'string') {
    if (isLikelyLocalFile(obj)) set.add(obj);
  } else if (Array.isArray(obj)) {
    for (const v of obj) collectPathsFromManifest(v, set);
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) collectPathsFromManifest(obj[k], set);
  }
}

function rewriteManifestPaths(obj, replacer) {
  if (typeof obj === 'string') return replacer(obj);
  if (Array.isArray(obj)) return obj.map(i => rewriteManifestPaths(i, replacer));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = rewriteManifestPaths(obj[k], replacer);
    return out;
  }
  return obj;
}

async function build() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    console.log(`\n🧹 Папка dist очищена`);
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const entries = fs.readdirSync(SRC_DIR, { withFileTypes: true });

  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const extName = dirent.name;
    const extSrcPath = path.join(SRC_DIR, extName);
    const manifestTemplatePath = path.join(extSrcPath, 'manifest.template.json');

    if (!fs.existsSync(manifestTemplatePath)) {
      console.log(`> Пропускаю "${extName}" — manifest.template.json не найден.`);
      continue;
    }

    console.log(`\n=== Сборка расширения: ${extName} ===`);
    const extDistPath = path.join(DIST_DIR, extName);

    fs.rmSync(extDistPath, { recursive: true, force: true });
    fs.mkdirSync(extDistPath, { recursive: true });

    const manifestRaw = fs.readFileSync(manifestTemplatePath, 'utf8');
    let manifestObj;
    try {
      manifestObj = JSON.parse(manifestRaw);
    } catch (e) {
      console.error(`Ошибка парсинга ${manifestTemplatePath}:`, e.message);
      continue;
    }

    const candidates = new Set();
    collectPathsFromManifest(manifestObj, candidates);

    // Соберём все JS/TS entry через Parcel API
    const scriptEntries = [];
    const staticFiles = [];

    for (const candidate of candidates) {
      const candidateClean = candidate.replace(/^\.\//, '');
      const absSrc = path.join(extSrcPath, candidateClean);

      if (!fs.existsSync(absSrc)) {
        console.warn(`  ! Файл из manifest не найден: ${candidate}`);
        continue;
      }

      if (isScriptFile(candidate)) {
        scriptEntries.push(absSrc);
      } else if (isStaticFile(candidate)) {
        staticFiles.push({ abs: absSrc, rel: candidateClean });
      }
    }

    // Параллельно собираем все entry скрипты одной инстанцией Parcel
    if (scriptEntries.length > 0) {
      console.log(`  - Сборка JS/TS entry (${scriptEntries.length} файлов)`);
      const bundler = new Parcel({
        entries: scriptEntries,
        defaultConfig: '@parcel/config-default',
        mode: 'production',
        targets: {
          default: {
            distDir: extDistPath,
            publicUrl: './',
          },
        },
        defaultTargetOptions: {
          shouldOptimize: false,
          shouldScopeHoist: false,
          sourceMaps: false,
          engines: { browsers: ['last 2 Chrome versions'] },
          distDir: extDistPath,
          publicUrl: './',
        },
        env: process.env,   // <--- ВАЖНО: передаём переменные окружения в Parcel
        shouldDisableCache: true,
        shouldContentHash: false,
      });

      try {
        await bundler.run();
        console.log(`  ✅ Parcel собрал скрипты.`);
      } catch (err) {
        console.error(`  Ошибка сборки скриптов:`, err);
      }
    }

    // Копируем статические ассеты
    for (const f of staticFiles) {
      const targetPath = path.join(extDistPath, f.rel);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(f.abs, targetPath);
      console.log(`  - Копирование статического файла: ${f.rel}`);
    }

    // Переписывание manifest.json
    function replacer(originalStr) {
      if (!isLikelyLocalFile(originalStr)) return originalStr;
      const originalClean = originalStr.replace(/^\.\//, '');

      const candidate1 = path.join(extDistPath, originalClean);
      if (fs.existsSync(candidate1)) return './' + normalizeToPosix(originalClean);

      const base = path.basename(originalClean);
      const candidate2 = path.join(extDistPath, base);
      if (fs.existsSync(candidate2)) return './' + base;

      const found = findFileRecursively(extDistPath, base);
      if (found) {
        const rel = path.relative(extDistPath, found);
        return './' + normalizeToPosix(rel);
      }

      console.warn(`  ⚠️ Не найден файл для "${originalStr}". Оставляю оригинальный путь.`);
      return originalStr;
    }

    const newManifest = rewriteManifestPaths(manifestObj, replacer);
    const outManifestPath = path.join(extDistPath, 'manifest.json');
    fs.writeFileSync(outManifestPath, JSON.stringify(newManifest, null, 2), 'utf8');
    console.log(`  ✅ manifest.json записан: ${outManifestPath}`);
  }

  console.log('\nСборка всех расширений завершена.');
}

build().catch(err => {
  console.error('Ошибка глобальной сборки:', err);
  process.exit(1);
});
