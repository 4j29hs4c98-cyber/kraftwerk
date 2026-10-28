import { cachedRead, primeCache } from '../../lib/offline'
import { supabase, unwrap } from '../../lib/supabase'
import type { TablesUpdate } from '../../types/database'
import type { ProfileRow } from './types'

/** Offline der zuletzt geladene Stand, damit die App ohne Netz startet. */
export function fetchProfile(userId: string): Promise<ProfileRow> {
  return cachedRead('profile', async () => unwrap(await supabase.from('profiles').select('*').eq('id', userId).single()))
}

/** Profile entstehen per Trigger, der Client darf nur aktualisieren. */
export async function updateProfile(userId: string, patch: TablesUpdate<'profiles'>): Promise<ProfileRow> {
  const row = unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select('*').single())
  await primeCache('profile', row)
  return row
}
