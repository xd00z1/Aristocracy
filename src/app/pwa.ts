/**
 * Service-worker registration through vite-plugin-pwa. `registerType` is
 * `autoUpdate` in vite.config.ts, so a new build takes over on the next
 * visit; nothing is shown to the user. Safe to call where there is no
 * service worker (tests, old browsers, some in-app webviews).
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
      onRegisterError(error: unknown) {
        // Not fatal: the app runs without offline support.
        console.warn('[pwa] service worker registration failed', error)
      },
    })
  } catch (error) {
    console.warn('[pwa] service worker registration threw', error)
  }
}
