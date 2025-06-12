// Global type declarations for the application

interface Window {
  _pendingRequests?: Map<string, AbortController>;
} 