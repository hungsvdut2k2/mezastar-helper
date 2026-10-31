import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement scrolling.
window.scrollTo = () => {};

// jsdom does not implement object URLs.
let objectUrlCount = 0;
URL.createObjectURL = () => `blob:test/${++objectUrlCount}`;
URL.revokeObjectURL = () => {};

afterEach(() => cleanup());
