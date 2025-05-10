// Environment configuration

// For development/testing, provide fallback values
export const env = {
  MOCK_PLANNER: import.meta.env?.VITE_MOCK_PLANNER || '1',
  NODE_ENV: import.meta.env?.MODE || 'development',
  // Add other environment variables as needed
}; 