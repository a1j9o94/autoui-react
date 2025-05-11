import '@testing-library/jest-dom';

// Global test setup here
// This file is run before all tests

// Example: Mock global objects if needed
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})); 