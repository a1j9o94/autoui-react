/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_PLANNER: string;
  readonly MODE: string;
  readonly VITE_OPENAI_API_KEY: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
