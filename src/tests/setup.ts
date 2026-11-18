import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Polyfill simples para scrollIntoView em jsdom
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
