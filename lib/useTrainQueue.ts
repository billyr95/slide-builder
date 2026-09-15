import { useEffect, useState } from 'react'
import { get, set } from 'idb-keyval'
import { TrainEntry } from './trainTypes'

// IndexedDB instead of localStorage — the queue holds base64-encoded images
// and can easily exceed localStorage's ~5MB per-origin ceiling.
const STORAGE_KEY = 'slide-builder-train-queue'

export function useTrainQueue() {
  const [queue, setQueue] = useState<TrainEntry[]>([])
  // Real state (not a ref) so the save effect below only ever runs, with the
  // up-to-date `queue` in its own closure, on a render that happens after
  // the load effect's setQueue has actually been applied — otherwise it can
  // fire in the same commit as the load, see the pre-load empty array, and
  // overwrite storage before the loaded data ever reaches the screen.
  const [loaded, setLoaded] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  // Load once on mount (client-only — IndexedDB isn't available during SSR).
  useEffect(() => {
    let cancelled = false
    get<TrainEntry[]>(STORAGE_KEY)
      .then(stored => {
        if (!cancelled && stored) setQueue(stored)
      })
      .catch(e => {
        console.warn('Failed to load training queue from IndexedDB', e)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  // Persist on every change, once loading has completed.
  useEffect(() => {
    if (!loaded) return
    set(STORAGE_KEY, queue)
      .then(() => setStorageWarning(null))
      .catch(e => {
        console.warn('Failed to save training queue to IndexedDB', e)
        setStorageWarning('Queue failed to save locally — export soon or remove some entries, or a refresh could lose data.')
      })
  }, [queue, loaded])

  function addEntry(entry: TrainEntry) {
    setQueue(q => [entry, ...q])
  }

  function updateEntry(entry: TrainEntry) {
    setQueue(q => q.map(e => (e.id === entry.id ? entry : e)))
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

  return { queue, loaded, storageWarning, addEntry, updateEntry, removeEntry, removeEntries, clearQueue }
}
