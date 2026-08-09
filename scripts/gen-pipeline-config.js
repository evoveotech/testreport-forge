// Generate pipeline-sources.json with classification rules for all products.
// 100% real open-source data — no mock/local data.
// All runs go to the same tenant so they're visible in one dashboard view.

const fs = require('fs');
const path = require('path');

const TEST_DATA_DIR = path.resolve(__dirname, '..', 'test-ci-data');
const CONFIG_FILE = path.resolve(__dirname, '..', 'pipeline-sources.json');

// Map product names to meaningful team names and stacks
const PRODUCT_META = {
  'react-timeline-gantt':       { team: 'frontend-widgets',    stack: 'jest',       repo: 'guiqui/react-timeline-gantt' },
  'rn-carousel':                { team: 'mobile-ui',           stack: 'jest',       repo: 'dohooo/react-native-reanimated-carousel' },
  'angular-starter':            { team: 'frontend-starter',    stack: 'karma',      repo: 'wlucha/angular-starter' },
  'samvera-ramp':               { team: 'digital-libraries',   stack: 'jest',       repo: 'samvera-labs/ramp' },
  'codecov-test-results':       { team: 'devtools-ci',         stack: 'jest',       repo: 'codecov/test-results-action' },
  'rocket-components':          { team: 'enterprise-web',      stack: 'jest',       repo: 'osstotalsoft/rocket-webapp-components' },
  'pst-extractor':              { team: 'data-engineering',    stack: 'jest',       repo: 'epfromer/pst-extractor' },
  'jupyterlab-quarto':          { team: 'data-science-tools',  stack: 'jest',       repo: 'quarto-dev/jupyterlab-quarto' },
  'jupyterlab-horizon':         { team: 'data-science-tools',  stack: 'jest',       repo: 'mohirio/jupyterlab-horizon-theme' },
  'node-steamgriddb':           { team: 'gaming-platform',     stack: 'jest',       repo: 'SteamGridDB/node-steamgriddb' },
  'notion-ts-client':           { team: 'productivity-tools',  stack: 'jest',       repo: 'velsa/notion-ts-client' },
  'ngrx-auto-entity':           { team: 'angular-ecosystem',   stack: 'karma',      repo: 'briebug/ngrx-auto-entity' },
  'xunit-viewer':               { team: 'dev-tools',           stack: 'xunit',      repo: 'lukejpreston/xunit-viewer' },
  'frontend-testing-guide':     { team: 'education',           stack: 'mocha',      repo: 'PacktPublishing/A-Frontend-Web-Developers-Guide-to-Testing' },
  'pw-ai-agent':                { team: 'ai-testing',          stack: 'playwright', repo: 'padmarajnidagundi/Playwright-AI-Agent-POM-MCP-Server' },
  'django-adminactions':        { team: 'python-web',          stack: 'pytest',     repo: 'saxix/django-adminactions' },
  'whisperx-fastapi':           { team: 'ml-infra',            stack: 'pytest',     repo: 'pavelzbornik/whisperX-FastAPI' },
  'flexible-fl':                { team: 'research-tools',      stack: 'pytest',     repo: 'FLEXible-FL/FLEXible' },
  'grpc-todo-list':             { team: 'backend-services',    stack: 'pytest',     repo: 'luru-eb/grpc-todo-list' },
  'aws-devops-course':          { team: 'cloud-training',      stack: 'unittest',   repo: 'SichengPan/AWS_DevOps_Course' },
  'flaui-uiautomation':         { team: 'desktop-automation',  stack: 'pytest',     repo: 'amruthvvkp/flaui-uiautomation-wrapper' },
  'fast-track-framework':       { team: 'python-frameworks',   stack: 'nose',       repo: 'eveschipfer/fast-track-framework' },
  'hostingproxmox':             { team: 'infra-management',    stack: 'pytest',     repo: 'minet/hostingproxmox' },
  'unifi-protect-downloader':   { team: 'video-tools',         stack: 'junit',      repo: 'danielfernau/unifi-protect-video-downloader' },
  'botscanner':                 { team: 'security-tools',      stack: 'junit',      repo: 'Linktech-Engineering-LLC/BotScanner-Community' },
  'bs-app-tests':               { team: 'mobile-testing',      stack: 'testng',     repo: 'adityabi2956/bs-app-tests' },
  'aquality-tracking':          { team: 'qa-automation',       stack: 'mstest',     repo: 'aquality-automation/aquality-tracking-ui' },
  'nesper':                     { team: 'dotnet-streaming',    stack: 'nunit',      repo: 'espertechinc/nesper' },
  'aquality-api':               { team: 'qa-automation',       stack: 'mstest',     repo: 'aquality-automation/aquality-tracking-api' },
  'xtra4u':                     { team: 'php-apps',            stack: 'phpunit',    repo: 'lankyghana/XTRA4U' },
  'filament-firewall':          { team: 'laravel-ecosystem',   stack: 'phpunit',    repo: 'solutionforest/filament-firewall' },
  'filament-sql-field':         { team: 'laravel-ecosystem',   stack: 'phpunit',    repo: 'MrPowerUp82/filament-sql-field' },
  'php-datatypes':              { team: 'php-libs',            stack: 'phpunit',    repo: 'Nejcc/php-datatypes' },
  'laravel-api-generator':      { team: 'laravel-ecosystem',   stack: 'phpunit',    repo: 'alibori/laravel-api-resource-generator' },
  'laravel-oembed':             { team: 'laravel-ecosystem',   stack: 'phpunit',    repo: 'webwizardsusa/laravel-oembed' },
  'lz-string-ruby':             { team: 'ruby-gems',           stack: 'rspec',      repo: 'altivi/lz_string' },
  'azure-flutter-tasks':        { team: 'mobile-ci',           stack: 'flutter',    repo: 'hey24sheep/azure-flutter-tasks' },
  'dart-junitreport':           { team: 'dart-tools',          stack: 'dart',       repo: 'TOPdesk/dart-junitreport' },
  'flutter-course-android':     { team: 'mobile-edu',          stack: 'espresso',   repo: 'omarahmedx14/flutter_advanced_course' },
  'pw-saucedemo':               { team: 'e2e-automation',      stack: 'playwright', repo: 'JayKishoreDuvvuri/Playwright-JavaScript-SauceDemo' },
  'pw-demo':                    { team: 'e2e-automation',      stack: 'playwright', repo: 'njbalraj24/PW_DEMO' },
  'daviplata-ios':              { team: 'ios-banking',         stack: 'xctest',     repo: 'pruebascivi/daviplata-ios-final' },
  'ipylgbst':                   { team: 'robotics-tools',      stack: 'jest',       repo: 'jupyter-robotics/ipylgbst' },
};

// Generate rules for all real OSS products
const realProducts = fs.existsSync(TEST_DATA_DIR)
  ? fs.readdirSync(TEST_DATA_DIR).filter(d => fs.statSync(path.join(TEST_DATA_DIR, d)).isDirectory())
  : [];

const realRules = realProducts.map(product => {
  const meta = PRODUCT_META[product] || { team: product + '-team', stack: 'jest', repo: product };
  return {
    match: { connector: 'local-ci', repoName: `^${product}$` },
    orgContext: {
      tenantId: 'acme',        // single tenant so all runs are visible in one dashboard
      client: 'open-source',
      product,
      team: meta.team,
      stack: meta.stack,
      runType: 'pr',
      environment: 'ci',
    },
  };
});

const config = {
  connectors: [{ id: 'local-ci', kind: 'local', rootDir: './test-ci-data' }],
  classificationRules: realRules,
};

fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
console.log(`Generated ${config.classificationRules.length} classification rules for ${realProducts.length} open-source products`);
console.log(`Unique teams: ${new Set(realRules.map(r => r.orgContext.team)).size}`);
console.log(`All runs under tenant: acme (client: open-source)`);
