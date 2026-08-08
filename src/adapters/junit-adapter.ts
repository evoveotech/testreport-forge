/**
 * JUnit XML Adapter
 *
 * Parses JUnit XML test results — the de-facto universal interchange format
 * emitted by Cypress, Selenium, Jest (jest-junit), Vitest (vitest-junit),
 * Pytest (pytest --junitxml), Go (go-junit-report), Java (Maven Surefire,
 * Gradle), TestNG, SoapUI (JUnit report export), Newman (junit reporter),
 * WebdriverIO, and many more.
 *
 * Spec reference: https://github.com/testmoapp/junitxml
 * We parse defensively to tolerate the many real-world variants.
 */

import * as path from 'path';
import type { TestResultData, StepData } from '../types';
import type { TestRunAdapter, AdapterContext, IngestedRun, FrameworkInfo } from './types';

/**
 * Minimal DOM-like node used by the hand-rolled XML parser.
 * Avoids a dependency on an XML library; JUnit XML is simple enough to parse
 * with a tag-stack approach that tolerates missing/malformed attributes.
 */
interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/**
 * Tolerant XML parser. Handles CDATA, self-closing tags, and attributes
 * with single/double quotes. Not a general-purpose XML parser — tuned for
 * JUnit XML's shape (testsuites > testsuite > testcase / properties / system-out).
 */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { tag: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  const n = xml.length;

  while (i < n) {
    // Skip text/whitespace between tags
    if (xml[i] !== '<') {
      const next = xml.indexOf('<', i);
      const text = next === -1 ? xml.slice(i) : xml.slice(i, next);
      stack[stack.length - 1].text += text;
      i = next === -1 ? n : next;
      continue;
    }

    // Comment or DOCTYPE or CDATA or processing instruction
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (xml.startsWith('<!', i)) {
      const end = xml.indexOf('>', i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (xml.startsWith('<?', i)) {
      // Processing instruction (e.g. <?xml version="1.0"?>) — skip entirely
      const end = xml.indexOf('?>', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i + 9);
      const cdata = end === -1 ? xml.slice(i + 9) : xml.slice(i + 9, end);
      stack[stack.length - 1].text += cdata;
      i = end === -1 ? n : end + 3;
      continue;
    }

    // Closing tag
    if (xml[i + 1] === '/') {
      const end = xml.indexOf('>', i + 2);
      i = end === -1 ? n : end + 1;
      if (stack.length > 1) stack.pop();
      continue;
    }

    // Opening tag — parse tag name and attributes
    const end = xml.indexOf('>', i + 1);
    if (end === -1) break;
    let tagContent = xml.slice(i + 1, end);
    const isSelfClosing = tagContent.endsWith('/');
    if (isSelfClosing) tagContent = tagContent.slice(0, -1).trim();

    const spaceIdx = tagContent.search(/[\s]/);
    const tag = spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx);
    const attrStr = spaceIdx === -1 ? '' : tagContent.slice(spaceIdx + 1);

    const attrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      attrs[m[1]] = m[2] ?? m[3] ?? '';
    }

    const node: XmlNode = { tag: tag.toLowerCase(), attrs, children: [], text: '' };
    stack[stack.length - 1].children.push(node);
    if (!isSelfClosing) stack.push(node);

    i = end + 1;
  }

  return root;
}

function findChildren(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter(c => c.tag === tag);
}

export { findChildren };

function findChild(node: XmlNode, tag: string): XmlNode | undefined {
  return node.children.find(c => c.tag === tag);
}

export { findChild };

function findAllDescendants(node: XmlNode, tag: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (n: XmlNode): void => {
    for (const c of n.children) {
      if (c.tag === tag) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

export { findAllDescendants };

function parseDurationMs(raw: string | undefined): number {
  if (!raw) return 0;
  const v = parseFloat(raw);
  if (isNaN(v)) return 0;
  // JUnit XML attributes are conventionally in seconds; some emitters use ms.
  // Heuristic: values < 1000 with a fractional part are seconds; treat <= 1000
  // and containing a '.' as seconds. Otherwise assume already ms.
  if (v <= 1000 && raw.includes('.')) return Math.round(v * 1000);
  return Math.round(v);
}

function normalizeStatus(testcase: XmlNode): TestResultData['status'] {
  // A testcase with a failure/error child is failed; with skipped is skipped.
  if (findChild(testcase, 'failure') || findChild(testcase, 'error')) return 'failed';
  if (findChild(testcase, 'skipped')) return 'skipped';
  return 'passed';
}

function extractError(testcase: XmlNode): string | undefined {
  const failure = findChild(testcase, 'failure') || findChild(testcase, 'error');
  if (!failure) return undefined;
  const msg = failure.attrs.message || failure.attrs.type;
  const body = failure.text.trim();
  if (body && msg) return `${msg}\n${body}`;
  return body || msg || 'Test failed';
}

export function escapeXmlText(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function buildTestId(classname: string, name: string): string {
  const cls = classname || '(unknown)';
  return `${cls}::${name}`;
}

/**
 * Detect the source framework from JUnit XML properties/metadata, when present.
 * Falls back to a generic 'JUnit XML' label.
 */
function detectFramework(root: XmlNode): FrameworkInfo {
  // Some emitters record the framework in <properties><property name="framework" .../>
  const suites = findChildren(root, 'testsuites');
  const top = suites.length > 0 ? suites[0] : root;
  const testSuites = findChildren(top, 'testsuite');
  const props = testSuites.length > 0 ? findChild(testSuites[0], 'properties') : undefined;
  if (props) {
    const findProp = (key: string): string | undefined =>
      findChildren(props, 'property').find(p => p.attrs.name === key)?.attrs.value;
    const fw = findProp('framework') || findProp('runner');
    if (fw) return { id: fw.toLowerCase(), label: fw, version: findProp('framework.version') };
  }
  return { id: 'junit', label: 'JUnit XML' };
}

export class JUnitAdapter implements TestRunAdapter {
  readonly format = 'junit' as const;
  readonly name = 'JUnit XML';

  matches(content: string, inputPath?: string): boolean {
    if (inputPath) {
      const ext = path.extname(inputPath).toLowerCase();
      if (ext === '.xml' || ext === '.junit') {
        return /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
      }
    }
    return /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
  }

  ingest(ctx: AdapterContext): IngestedRun {
    const xml = ctx.content ?? '';
    const root = parseXml(xml);
    const framework = detectFramework(root);

    // Apply user override
    if (ctx.options.framework) {
      framework.label = ctx.options.framework;
      framework.id = ctx.options.framework.toLowerCase();
    }

    const results: TestResultData[] = [];
    let totalDuration = 0;

    // Find all testsuite nodes (may be nested under <testsuites> or standalone)
    const testSuites = findAllDescendants(root, 'testsuite');

    for (const suite of testSuites) {
      const suiteName = escapeXmlText(suite.attrs.name || '');
      const suiteFile = suite.attrs.file || suite.attrs.package || suiteName || 'tests';

      const cases = findChildren(suite, 'testcase');
      for (const tc of cases) {
        const name = escapeXmlText(tc.attrs.name || 'Unknown test');
        const classname = escapeXmlText(tc.attrs.classname || suiteName);
        const file = tc.attrs.file || `${suiteFile}.xml`;
        const duration = parseDurationMs(tc.attrs.time);
        totalDuration += duration;
        const status = normalizeStatus(tc);
        const error = extractError(tc);

        // Build a single step representing the test execution timing
        const steps: StepData[] = duration > 0
          ? [{ title: name, duration, category: 'test.step' }]
          : [];

        // Suite hierarchy: classname often encodes a dotted path (e.g. "Auth.Login")
        const suites = classname ? classname.split(/[.\/]/).filter(Boolean) : [];

        results.push({
          testId: buildTestId(classname, name),
          title: name,
          file,
          status,
          duration,
          retry: 0,
          steps,
          history: [],
          suite: suites.length > 0 ? suites[suites.length - 1] : suiteName || undefined,
          suites: suites.length > 0 ? suites : (suiteName ? [suiteName] : undefined),
          error,
          outcome: status === 'passed' ? 'expected' : status === 'skipped' ? 'skipped' : 'unexpected',
          expectedStatus: 'passed',
        });
      }
    }

    return {
      results,
      framework,
      duration: totalDuration,
    };
  }
}
