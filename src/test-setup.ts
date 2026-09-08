import 'fake-indexeddb/auto'

// jsdom does not implement scrolling; the session runner scrolls to the top
// between slots. Stub it so the test output stays free of "Not implemented".
if (typeof window !== 'undefined') window.scrollTo = () => {}
