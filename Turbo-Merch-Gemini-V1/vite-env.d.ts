/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_BRAVE_API_KEY?: string
  readonly VITE_GROK_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
