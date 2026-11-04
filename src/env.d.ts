/// <reference types="astro/client" />
declare module '@vitejs/plugin-react/preamble';
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly PUBLIC_AUTH_PROVIDERS?: string;
}
