/** Keep the SDK's existing key so deployed sessions survive upgrades. */
export function accountStorageKey(url = import.meta.env.PUBLIC_SUPABASE_URL): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}
