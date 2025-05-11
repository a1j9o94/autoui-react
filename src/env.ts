// Environment configuration

const rawApiKeyFromEnv = process.env.VITE_OPENAI_API_KEY;
const defaultApiKeyLiteral = "sk-proj-literal-default-for-debug-in-env-ts";

export const env = {
  MOCK_PLANNER: process.env.VITE_MOCK_PLANNER || "1", // Simplified MOCK_PLANNER assignment
  NODE_ENV: process.env.VITE_NODE_ENV || "development", // Simplified NODE_ENV assignment
  OPENAI_API_KEY:
    rawApiKeyFromEnv === undefined ? defaultApiKeyLiteral : rawApiKeyFromEnv,
};
