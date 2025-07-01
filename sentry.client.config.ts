// Disabled Sentry for Capacitor compatibility
// This is a no-op implementation

export const captureException = () => {};
export const captureMessage = () => {};
export const captureEvent = () => {};
export const startSpan = () => ({
  end: () => {},
  setName: () => {},
  setData: () => {},
});
export const init = () => {};
export const flush = async () => true;
export const close = async () => true;
export const withScope = (callback: any) => callback({ setTag: () => {}, setExtra: () => {} });
export const configureScope = () => {};

// Export a dummy object for any other imports
export default {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {},
  captureEvent: () => {},
  startSpan: () => ({
    end: () => {},
    setName: () => {},
    setData: () => {},
  }),
}; 
 