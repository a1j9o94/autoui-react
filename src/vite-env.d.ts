/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_PLANNER: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 