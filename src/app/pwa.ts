/**
 * Service-worker registration through vite-plugin-pwa. `registerType` is
 * `prompt` in vite.config.ts: a new build waits rather than seizing the page,
 * so nobody's lesson is reloaded out from under them. `onNeedRefresh` is
 * deliberately quiet — the waiting worker takes over on the next cold start.
 * Safe to call where there is no service worker (tests, old browsers, some
 * in-app webviews).
 */
import { registerSW } from 'virtual:pwa-register'

let registered = false

export function registerPwa(): void {
  if (registered) return
  registered = true
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // A newer build is installed and waiting. Nothing is reloaded here: a
        // reload mid-lesson would interrupt a session, and the new worker will
        // take over the next time the app is opened cold.
        console.info('[pwa] a new version is ready; it will be used next time the app is opened')
      },
      onRegisterError(error: unknown) {
        // Not fatal: the app runs without offline support.
        console.warn('[pwa] service worker registration failed', error)
      },
    })
  } catch (error) {
    console.warn('[pwa] service worker registration threw', error)
  }
}
