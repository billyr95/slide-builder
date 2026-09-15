import { useEffect, useState } from 'react'
import { TrainEntry } from './trainTypes'

const STORAGE_KEY = 'slide-builder-train-queue'

export function useTrainQueue() {
  const [queue, setQueue] = useState<TrainEntry[]>([])
  // Real state (not a ref) so the save effect below only ever runs, with the
  // up-to-date `queue` in its own closure, on a render that happens after
  // the load effect's setQueue has actually been applied — otherwise it can
  // fire in the same commit as the load, see the pre-load empty array, and
  // overwrite localStorage before the loaded data ever reaches the screen.
  const [loaded, setLoaded] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  // Load once on mount (client-only — localStorage isn't available during SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setQueue(JSON.parse(raw))
    } catch (e) {
      console.warn('Failed to load training queue from localStorage', e)
    }
    setLoaded(true)
  }, [])

  // Persist on every change, once loading has completed.
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
      setStorageWarning(null)
    } catch (e) {
      console.warn('Failed to save training queue to localStorage', e)
      setStorageWarning('Queue is too large to save locally — export soon or remove some entries, or a refresh could lose data.')
    }
  }, [queue, loaded])

  function addEntry(entry: TrainEntry) {
    setQueue(q => [entry, ...q])
  }

  function removeEntry(id: string) {
    setQueue(q => q.filter(e => e.id !== id))
  }

  function removeEntries(ids: Set<string>) {
    setQueue(q => q.filter(e => !ids.has(e.id)))
  }

  function clearQueue() {
    setQueue([])
  }

  return { queue, loaded, storageWarning, addEntry, removeEntry, removeEntries, clearQueue }
}
