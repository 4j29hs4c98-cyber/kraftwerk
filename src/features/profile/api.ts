import { supabase, unwrap } from '../../lib/supabase'
import type { TablesUpdate } from '../../types/database'
import type { ProfileRow } from './types'

export async function fetchProfile(userId: string): Promise<ProfileRow> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single())
}

/** Profile entstehen per Trigger, der Client darf nur aktualisieren. */
export async function updateProfile(userId: string, patch: TablesUpdate<'profiles'>): Promise<ProfileRow> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select('*').single())
}
