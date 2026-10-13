const trimSlash = (url: string) => url.replace(/\/$/, '')

export const API_BASE_URL = trimSlash(
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8080' : '')
)

export const COLLABORATION_WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? 'ws://localhost:8080/ws/collaboration'
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/collaboration`)
