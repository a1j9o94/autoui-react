// Environment configuration

// Get environment variables from various sources
function getEnvVar(name: string, defaultValue: string | null): string | null {
  // Check import.meta.env first (Vite)
  if (typeof import.meta.env !== "undefined" && import.meta.env[name]) {
    return import.meta.env[name];
  }

  // Check window.__env__ for browser environments (Next.js, etc)
  if (
    typeof window !== "undefined" &&
    (window as any).__env &&
    (window as any).__env[name]
  ) {
    return (window as any).__env[name];
  }

  // Check process.env for Node environments
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[name];
    if (value) return value;

    // Try with NEXT_PUBLIC_ prefix
    const nextPublicName = `NEXT_PUBLIC_${name}`;
    if (process.env[nextPublicName]) {
      return process.env[nextPublicName];
    }
  }

  // Use default value if none found
  return defaultValue;
}

// For development/testing, provide fallback values
export const env = {
  MOCK_PLANNER: getEnvVar("VITE_MOCK_PLANNER", "1"),
  NODE_ENV: getEnvVar("MODE", "development"),
  OPENAI_API_KEY: getEnvVar("VITE_OPENAI_API_KEY", null),
  // Add other environment variables as needed
};
