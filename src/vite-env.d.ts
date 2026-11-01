/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gemini API key for reading stats from tag photos. Injected at build time from the GEMINI_API_KEY secret; public in the bundle. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Overrides the Gemini model used for reading tag photos. */
  readonly VITE_GEMINI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
