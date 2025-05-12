// Environment configuration

const rawApiKeyFromEnv = process.env.VITE_OPENAI_API_KEY;

export const env = {
  MOCK_PLANNER: process.env.VITE_MOCK_PLANNER || "0", // Simplified MOCK_PLANNER assignment
  NODE_ENV: process.env.VITE_NODE_ENV || "production", // Simplified NODE_ENV assignment
  OPENAI_API_KEY: rawApiKeyFromEnv || "",
};
