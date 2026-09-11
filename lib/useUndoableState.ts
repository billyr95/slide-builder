import { useReducer, useRef, useCallback, useEffect } from 'react'

interface State<T> {
  past: T[]
  present: T
  future: T[]
  pendingBase: T | null
}

type Action<T> =
  | { type: 'SET'; payload: T }
  | { type: 'COMMIT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; payload: T }

const MAX_HISTORY = 50

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case 'SET': {
      const pendingBase = state.pendingBase ?? state.present
      return { ...state, present: action.payload, pendingBase, future: [] }
    }
    case 'COMMIT': {
      if (state.pendingBase === null) return state
      const past = [...state.past, state.pendingBase].slice(-MAX_HISTORY)
      return { ...state, past, pendingBase: null }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        pendingBase: null,
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        pendingBase: null,
      }
    }
    case 'RESET':
      return { past: [], present: action.payload, future: [], pendingBase: null }
    default:
      return state
  }
}

// Debounces rapid changes (e.g. every keystroke in a text field) into a
// single undo step, so undo moves in meaningful chunks rather than one
// character at a time. Loading/creating a new document should call `reset`
// so its history doesn't get entangled with whatever was open before it.
export function useUndoableState<T>(initial: T, debounceMs = 500) {
  const [state, dispatch] = useReducer(reducer<T>, {
    past: [],
    present: initial,
    future: [],
    pendingBase: null,
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const set = useCallback((value: T) => {
    dispatch({ type: 'SET', payload: value })
    clearTimer()
    timerRef.current = setTimeout(() => dispatch({ type: 'COMMIT' }), debounceMs)
  }, [debounceMs])

  const undo = useCallback(() => {
    clearTimer()
    dispatch({ type: 'UNDO' })
  }, [])

  const redo = useCallback(() => {
    clearTimer()
    dispatch({ type: 'REDO' })
  }, [])

  const reset = useCallback((value: T) => {
    clearTimer()
    dispatch({ type: 'RESET', payload: value })
  }, [])

  useEffect(() => clearTimer, [])

  return {
    value: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
