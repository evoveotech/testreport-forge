// Fix PHPUnit: replace config files with real test result files
const https = require('https');
const fs = require('fs');
const path = require('path');

const TEST_DATA_DIR = path.resolve(__dirname, '..', 'test-ci-data');

const sources = [
  { url: 'https://raw.githubusercontent.com/lankyghana/XTRA4U/main/build/phpunit-results.xml', product: 'xtra4u', team: 'php-apps', stack: 'phpunit' },
  { url: 'https://raw.githubusercontent.com/solutionforest/filament-firewall/4.x/build/report.junit.xml', product: 'filament-firewall', team: 'laravel-ecosystem', stack: 'phpunit' },
  { url: 'https://raw.githubusercontent.com/MrPowerUp82/filament-sql-field/main/build/report.junit.xml', product: 'filament-sql-field', team: 'laravel-ecosystem', stack: 'phpunit' },
  { url: 'https://raw.githubusercontent.com/Nejcc/php-datatypes/master/build/logs/junit.xml', product: 'php-datatypes', team: 'php-libs', stack: 'phpunit' },
  { url: 'https://raw.githubusercontent.com/alibori/laravel-api-resource-generator/main/build/report.junit.xml', product: 'laravel-api-generator', team: 'laravel-ecosystem', stack: 'phpunit' },
  { url: 'https://raw.githubusercontent.com/webwizardsusa/laravel-oembed/master/build/report.junit.xml', product: 'laravel-oembed', team: 'laravel-ecosystem', stack: 'phpunit' },
];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'testreport-forge' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { download(res.headers.location).then(resolve).catch(reject); return; }
      if (res.statusCode !== 200) { reject(new Error(url + ' returned ' + res.statusCode)); return; }
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => resolve(buf)); res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // Remove old PHPUnit config files
  const oldProducts = ['commlink', 'crawler-detect', 'firefly-iii-importer', 'many-notes', 'shetabit-payment', 'venture'];
  for (const p of oldProducts) {
    const dir = path.join(TEST_DATA_DIR, p);
    if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true }); console.log('Removed old config file:', p); }
  }

  for (const s of sources) {
    try {
      const content = await download(s.url);
      const testMatch = content.match(/tests="(\d+)"/);
      const testCount = testMatch ? testMatch[1] : '?';
      console.log(s.product + ': ' + content.length + ' chars, ~' + testCount + ' tests');

      const runId = 'real-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
      const runDir = path.join(TEST_DATA_DIR, s.product, runId);
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(path.join(runDir, 'artifact.xml'), content, 'utf-8');
      fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify({
        commit: Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
        branch: 'main', trigger: 'pull_request',
        occurredAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
        ciRunUrl: 'https://github.com/' + s.product + '/actions/runs/' + Math.floor(Math.random() * 9000000000 + 1000000000),
        duration: Math.floor(Math.random() * 120000 + 10000),
      }, null, 2), 'utf-8');
    } catch (e) { console.error(s.product + ': FAILED - ' + e.message); }
  }
}
main().catch(console.error);
