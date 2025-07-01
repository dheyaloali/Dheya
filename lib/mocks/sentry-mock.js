/**
 * Mock implementation of Sentry for static export
 * This prevents errors during the Next.js static build process
 */

// Mock the core Sentry functionality
const sentryMock = {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {},
  withScope: (callback) => callback({ setExtra: () => {} }),
  configureScope: () => {},
  setUser: () => {},
  setTag: () => {},
  setTags: () => {},
  setExtra: () => {},
  setExtras: () => {},
  setContext: () => {},
  addBreadcrumb: () => {},
  startTransaction: () => ({
    finish: () => {},
    setName: () => {},
    setData: () => {},
  }),
};

// Mock NextJS specific functions
const nextjsMock = {
  ...sentryMock,
  withSentry: (handler) => handler,
  getServerSideProps: (handler) => handler,
  withServerSideProps: (handler) => handler,
};

// Export all mock functions
module.exports = {
  ...sentryMock,
  ...nextjsMock,
  Severity: {
    Fatal: 'fatal',
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
    Debug: 'debug',
  },
  // Mock all common Sentry exports
  captureEvent: () => {},
  close: () => Promise.resolve(true),
  flush: () => Promise.resolve(true),
  lastEventId: () => null,
  showReportDialog: () => {},
  forceLoad: () => {},
  onLoad: (callback) => callback(),
  getCurrentHub: () => ({
    getClient: () => null,
    getScope: () => null,
    pushScope: () => {},
    popScope: () => {},
    withScope: (callback) => callback({ setExtra: () => {} }),
    captureException: () => {},
    captureMessage: () => {},
    captureEvent: () => {},
  }),
}; 
 