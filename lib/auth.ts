import type { SupabaseClient } from '@supabase/supabase-js';

export async function getPostAuthenticationPath(
  client: SupabaseClient,
): Promise<'/mfa' | '/dashboard' | '/aguardando-aprovacao'> {
  const { data: linked, error: linkError } = await client.rpc('link_approved_member');
  if (linkError) throw linkError;

  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;

  if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') return '/mfa';
  return linked ? '/dashboard' : '/aguardando-aprovacao';
}
