// Opt into strict env typing: unknown `import.meta.env` keys become type errors instead of `any`.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  /** Base URL of the E-Deep API, e.g. `http://localhost:3000/api`. Optional at type level: checked at startup. */
  readonly VITE_API_BASE_URL?: string;
}
