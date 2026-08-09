import { describe, it, expect } from 'vitest';
import { XCTestAdapter } from './xctest-adapter';
import { EspressoAdapter } from './espresso-adapter';
import { AppiumAdapter } from './appium-adapter';
import { detectAdapter, getAdapter } from './index';
import type { AdapterContext } from './types';

function ctx(content: string, inputPath?: string, opts?: Record<string, unknown>): AdapterContext {
  return {
    content,
    inputPath,
    outputDir: '.',
    options: opts ?? {},
  };
}

// A minimal JUnit XML with an xcodebuild marker in a property
const XCODEBUILD_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="XCTestSuite" tests="2" failures="1" time="1.5">
    <properties>
      <property name="runner" value="xcodebuild"/>
    </properties>
    <testcase classname="LoginTests" name="testLoginSuccess" time="0.8"/>
    <testcase classname="LoginTests" name="testLoginFailure" time="0.7">
      <failure message="XCTAssertEqual failed">expected 200 got 401</failure>
    </testcase>
  </testsuite>
</testsuites>`;

// A minimal JUnit XML with a com.android package marker
const ESPRESSO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="com.android.example.LoginTest" tests="2" failures="1" time="2.0">
    <testcase classname="com.android.example.LoginTest" name="loginSuccess" time="1.0"/>
    <testcase classname="com.android.example.LoginTest" name="loginFailure" time="1.0">
      <failure message="AssertionError">expected true got false</failure>
    </testcase>
  </testsuite>
</testsuites>`;

// A minimal JUnit XML with an Appium marker in a property
const APPIUM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="AppiumSuite" tests="2" failures="1" time="3.0">
    <properties>
      <property name="framework" value="Appium"/>
    </properties>
    <testcase classname="MobileTests" name="testOpenApp" time="1.5"/>
    <testcase classname="MobileTests" name="testTapButton" time="1.5">
      <failure message="ElementNotFound">button not found</failure>
    </testcase>
  </testsuite>
</testsuites>`;

// Plain JUnit XML without any mobile markers
const PLAIN_JUNIT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Auth Suite" tests="1" failures="0" time="0.5">
    <testcase classname="Auth.Login" name="should log in" time="0.5"/>
  </testsuite>
</testsuites>`;

describe('XCTestAdapter', () => {
  const adapter = new XCTestAdapter();

  it('matches by path containing "xctest"', () => {
    expect(adapter.matches(XCODEBUILD_XML, 'xctest-results.xml')).toBe(true);
  });

  it('matches by content with xcodebuild marker', () => {
    expect(adapter.matches(XCODEBUILD_XML, 'results.xml')).toBe(true);
  });

  it('does not match plain JUnit XML without xcodebuild marker', () => {
    expect(adapter.matches(PLAIN_JUNIT_XML, 'results.xml')).toBe(false);
  });

  it('does not match non-XML content', () => {
    expect(adapter.matches('hello world', 'xctest.txt')).toBe(false);
  });

  it('parses JUnit XML and sets framework id to xctest', () => {
    const run = adapter.ingest(ctx(XCODEBUILD_XML));
    expect(run.results).toHaveLength(2);
    expect(run.results[0].status).toBe('passed');
    expect(run.results[1].status).toBe('failed');
    expect(run.framework.id).toBe('xctest');
    expect(run.framework.label).toBe('XCTest');
  });

  it('extracts error messages from failures', () => {
    const run = adapter.ingest(ctx(XCODEBUILD_XML));
    expect(run.results[1].error).toContain('XCTAssertEqual failed');
  });
});

describe('EspressoAdapter', () => {
  const adapter = new EspressoAdapter();

  it('matches by path containing "espresso"', () => {
    expect(adapter.matches(ESPRESSO_XML, 'espresso-results.xml')).toBe(true);
  });

  it('matches by content with com.android marker', () => {
    expect(adapter.matches(ESPRESSO_XML, 'results.xml')).toBe(true);
  });

  it('does not match plain JUnit XML without com.android marker', () => {
    expect(adapter.matches(PLAIN_JUNIT_XML, 'results.xml')).toBe(false);
  });

  it('does not match non-XML content', () => {
    expect(adapter.matches('hello world', 'espresso.txt')).toBe(false);
  });

  it('parses JUnit XML and sets framework id to espresso', () => {
    const run = adapter.ingest(ctx(ESPRESSO_XML));
    expect(run.results).toHaveLength(2);
    expect(run.results[0].status).toBe('passed');
    expect(run.results[1].status).toBe('failed');
    expect(run.framework.id).toBe('espresso');
    expect(run.framework.label).toBe('Espresso');
  });

  it('extracts error messages from failures', () => {
    const run = adapter.ingest(ctx(ESPRESSO_XML));
    expect(run.results[1].error).toContain('AssertionError');
  });
});

describe('AppiumAdapter', () => {
  const adapter = new AppiumAdapter();

  it('matches by path containing "appium"', () => {
    expect(adapter.matches(APPIUM_XML, 'appium-results.xml')).toBe(true);
  });

  it('matches by content with Appium marker', () => {
    expect(adapter.matches(APPIUM_XML, 'results.xml')).toBe(true);
  });

  it('does not match plain JUnit XML without Appium marker', () => {
    expect(adapter.matches(PLAIN_JUNIT_XML, 'results.xml')).toBe(false);
  });

  it('does not match non-XML content', () => {
    expect(adapter.matches('hello world', 'appium.txt')).toBe(false);
  });

  it('parses JUnit XML and sets framework id to appium', () => {
    const run = adapter.ingest(ctx(APPIUM_XML));
    expect(run.results).toHaveLength(2);
    expect(run.results[0].status).toBe('passed');
    expect(run.results[1].status).toBe('failed');
    expect(run.framework.id).toBe('appium');
    expect(run.framework.label).toBe('Appium');
  });

  it('extracts error messages from failures', () => {
    const run = adapter.ingest(ctx(APPIUM_XML));
    expect(run.results[1].error).toContain('ElementNotFound');
  });
});

describe('auto-detection (detectAdapter) for mobile formats', () => {
  it('detects XCTest by xcodebuild marker', () => {
    const a = detectAdapter(XCODEBUILD_XML, 'results.xml');
    expect(a?.format).toBe('xctest');
  });

  it('detects Espresso by com.android marker', () => {
    const a = detectAdapter(ESPRESSO_XML, 'results.xml');
    expect(a?.format).toBe('espresso');
  });

  it('detects Appium by Appium marker', () => {
    const a = detectAdapter(APPIUM_XML, 'results.xml');
    expect(a?.format).toBe('appium');
  });

  it('still detects plain JUnit XML as junit', () => {
    const a = detectAdapter(PLAIN_JUNIT_XML, 'results.xml');
    expect(a?.format).toBe('junit');
  });
});

describe('getAdapter (explicit lookup) for mobile formats', () => {
  it('returns adapter by format id', () => {
    expect(getAdapter('xctest')?.format).toBe('xctest');
    expect(getAdapter('espresso')?.format).toBe('espresso');
    expect(getAdapter('appium')?.format).toBe('appium');
  });
});
