/**
 * Mock implementation of OpenTelemetry for static export
 * This prevents errors during the Next.js static build process
 */

// Create empty mock objects for all OpenTelemetry functionality
const instrumentationMock = {
  InstrumentationBase: class InstrumentationBase {
    constructor() {}
    init() {}
    enable() {}
    disable() {}
    setConfig() {}
    getConfig() { return {}; }
  },
  registerInstrumentations: () => {},
  registerInstrumentation: () => {},
  getInstrumentations: () => [],
  getNodeAutoInstrumentations: () => [],
};

// Export all mock functions
module.exports = {
  ...instrumentationMock,
  // Add additional mocks as needed
  diag: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    verbose: () => {},
  },
  metrics: {
    getMeter: () => ({
      createCounter: () => ({
        add: () => {},
      }),
      createUpDownCounter: () => ({
        add: () => {},
      }),
      createObservableGauge: () => ({
        observation: () => {},
      }),
      createHistogram: () => ({
        record: () => {},
      }),
    }),
  },
  trace: {
    getTracer: () => ({
      startSpan: () => ({
        end: () => {},
        setAttribute: () => {},
        setAttributes: () => {},
        recordException: () => {},
        updateName: () => {},
        isRecording: () => false,
      }),
      startActiveSpan: (name, options, fn) => {
        if (typeof options === 'function') {
          return options({
            end: () => {},
            setAttribute: () => {},
            setAttributes: () => {},
            recordException: () => {},
            updateName: () => {},
            isRecording: () => false,
          });
        }
        return fn({
          end: () => {},
          setAttribute: () => {},
          setAttributes: () => {},
          recordException: () => {},
          updateName: () => {},
          isRecording: () => false,
        });
      },
    }),
  },
}; 
 