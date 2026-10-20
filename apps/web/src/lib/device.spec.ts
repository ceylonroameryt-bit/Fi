import { describe, it, expect } from 'vitest';
import { describeDevice } from './device';

describe('describeDevice', () => {
  it('names common browsers and systems from a user agent', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS');
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0',
      ),
    ).toBe('Edge on Windows');
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe(
      'Firefox on Linux',
    );
  });

  it('falls back gracefully', () => {
    expect(describeDevice(null)).toBe('Unknown device');
    expect(describeDevice('curl/8.0')).toBe('Browser on unknown system');
  });
});
