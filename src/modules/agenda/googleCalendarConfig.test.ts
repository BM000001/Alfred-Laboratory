import { describe, expect, it } from 'vitest';
import { googleAppsScriptConfigurationError } from './googleCalendarApi';

const DEMO_ID = 'AKfycb' + 'A'.repeat(64);
const VALID_SHAPE = `https://script.google.com/macros/s/${DEMO_ID}/exec`;

describe('Google Calendar Apps Script deployment validation', () => {
  it('accepts the canonical Web App URL shape without claiming the deployment works', () => {
    expect(googleAppsScriptConfigurationError(VALID_SHAPE)).toBeNull();
  });

  it('blocks the example ID instead of opening a nonexistent Google Drive page', () => {
    expect(googleAppsScriptConfigurationError('https://script.google.com/macros/s/ID_DA_IMPLANTACAO/exec'))
      .toMatch(/ID de implantação de exemplo/);
  });

  it('rejects missing or malformed deployment IDs', () => {
    expect(googleAppsScriptConfigurationError('')).toMatch(/não foi configurada/);
    expect(googleAppsScriptConfigurationError('https://script.google.com/macros/s/abc123/exec'))
      .toMatch(/ID de implantação de exemplo/);
  });

  it('rejects URL impersonation, credentials and unexpected URL parameters', () => {
    const urls = [
      'http://script.google.com/macros/s/' + DEMO_ID + '/exec',
      'https://script.google.com.evil.example/macros/s/' + DEMO_ID + '/exec',
      'https://user@script.google.com/macros/s/' + DEMO_ID + '/exec',
      VALID_SHAPE + '?nonce=provided',
      VALID_SHAPE + '#fragment',
      'https://script.google.com/macros/u/1/s/' + DEMO_ID + '/exec',
    ];
    for (const url of urls) {
      expect(googleAppsScriptConfigurationError(url)).toMatch(/não é válida/);
    }
  });
});
