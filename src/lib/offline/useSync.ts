import { useEffect, useSyncExternalStore } from 'react'
import { startSyncTriggers, syncEngine, type SyncSnapshot } from './index'

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getSnapshot)
}

/** Startet die Auslöser für den Abgleich, solange ein Nutzer angemeldet ist. */
export function useSyncTriggers(): void {
  useEffect(() => startSyncTriggers(), [])
}

/** Ruft onChange auf, wenn ein Abgleich Daten zum Server gebracht hat. */
export function useOnSynced(onChange: () => void): void {
  useEffect(() => syncEngine.onApplied(onChange), [onChange])
}
