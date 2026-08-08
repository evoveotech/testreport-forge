import { describe, it, expect } from 'vitest';
import { generateLiveDashboard, generateLiveReportPage } from './live-dashboard';

describe('generateLiveDashboard', () => {
  it('generates valid HTML with polling mode by default', () => {
    const html = generateLiveDashboard({ jsonlFile: '.smart-live-results.jsonl' });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Live Test Results');
    expect(html).toContain('.smart-live-results.jsonl');
    expect(html).toContain('setInterval');
    expect(html).not.toContain('EventSource');
  });

  it('generates HTML with SSE mode when sseUrl is provided', () => {
    const html = generateLiveDashboard({
      jsonlFile: '.smart-live-results.jsonl',
      sseUrl: 'http://localhost:3000/sse',
    });

    expect(html).toContain('EventSource');
    expect(html).toContain('http://localhost:3000/sse');
    expect(html).not.toContain('setInterval');
  });

  it('includes progress bar, counters, and failure feed elements', () => {
    const html = generateLiveDashboard({ jsonlFile: '.smart-live-results.jsonl' });

    expect(html).toContain('id="progress-bar"');
    expect(html).toContain('id="counter-passed"');
    expect(html).toContain('id="counter-failed"');
    expect(html).toContain('id="counter-skipped"');
    expect(html).toContain('id="failure-feed"');
    expect(html).toContain('id="status-banner"');
  });

  it('escapes the jsonl file path to prevent XSS', () => {
    const html = generateLiveDashboard({ jsonlFile: '"><script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('generateLiveReportPage', () => {
  it('contains data-live-mode attribute', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('data-live-mode');
  });

  it('contains polling JS with correct JSONL path', () => {
    const html = generateLiveReportPage({ jsonlFile: '.smart-live-results.jsonl' });
    expect(html).toContain('.smart-live-results.jsonl');
    expect(html).toContain('setInterval');
  });

  it('contains auto-reload logic', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('waitForFinalReport');
    expect(html).toContain('window.location.reload');
  });

  it('contains SSE placeholder for serve rewriting', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('__SSE_URL__');
  });

  it('uses SSE directly when sseUrl is provided', () => {
    const html = generateLiveReportPage({
      jsonlFile: 'results.jsonl',
      sseUrl: '/sse',
    });
    expect(html).toContain('EventSource');
    expect(html).not.toContain('__SSE_URL__');
    expect(html).not.toContain('setInterval');
  });

  it('propagates title into HTML', () => {
    const html = generateLiveReportPage({
      jsonlFile: 'results.jsonl',
      title: 'My Test Suite',
    });
    expect(html).toContain('My Test Suite');
    expect(html).toContain('<title>My Test Suite — Live</title>');
  });

  it('uses default title when none provided', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('Smart Report');
  });

  it('escapes paths to prevent XSS', () => {
    const html = generateLiveReportPage({
      jsonlFile: '"><script>alert(1)</script>',
      title: '"><script>alert(2)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(2)</script>');
  });

  it('includes Space Grotesk font and report CSS custom properties', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('Space Grotesk');
    expect(html).toContain('--bg-primary');
    expect(html).toContain('--accent-green');
  });

  it('includes progress bar, counters, and failure feed', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('id="counter-passed"');
    expect(html).toContain('id="counter-failed"');
    expect(html).toContain('id="counter-flaky"');
    expect(html).toContain('id="counter-skipped"');
    expect(html).toContain('id="failure-feed"');
    expect(html).toContain('id="progress-track"');
  });

  it('includes live badge indicator', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('live-badge');
    expect(html).toContain('live-dot');
  });

  it('reads totalExpected (not totalTests) from start event', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('ev.totalExpected');
    expect(html).not.toContain('ev.totalTests');
  });

  it('includes timeout for waitForFinalReport polling', () => {
    const html = generateLiveReportPage({ jsonlFile: 'results.jsonl' });
    expect(html).toContain('maxFinalReportAttempts');
    expect(html).toContain('timed out');
  });
});
