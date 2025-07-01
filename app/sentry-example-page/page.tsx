"use client";

import { useState, useEffect } from 'react';
import Head from "next/head";
import * as Sentry from "@sentry/nextjs";

class SentryExampleFrontendError extends Error {
  constructor(message) {
    super(message);
    this.name = "SentryExampleFrontendError";
  }
}

export default function SentryExamplePage() {
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);
  const [apiError, setApiError] = useState(false);

  // Trigger an error on the frontend
  const triggerError = () => {
    setError(true);
    throw new SentryExampleFrontendError("This is an example frontend error");
  };

  // Trigger an error on the API
  const triggerApiError = async () => {
    try {
      const response = await fetch("/api/sentry-example-api");
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      console.log(data);
    } catch (err) {
      setApiError(true);
      Sentry.captureException(err);
    }
  };
  
  useEffect(() => {
    // This is used to test that Sentry is working
    Sentry.configureScope((scope) => {
      scope.setTag("page", "sentry-example");
      scope.setContext("counter", { count });
    });
  }, [count]);

  if (error) {
    return <div>An error was triggered!</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>Sentry Example</title>
      </Head>
      <h1 className="text-2xl font-bold mb-4">Sentry Example</h1>
      <p className="mb-4">
        This page demonstrates Sentry error monitoring. Click the buttons below to trigger errors.
      </p>

      <div className="mb-4">
        <p>Counter: {count}</p>
        <button
          onClick={() => setCount(count + 1)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
        >
          Increment
        </button>
          </div>

      <div className="space-y-4">
        <button
          onClick={triggerError}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded block"
        >
          Trigger Frontend Error
        </button>

        <button
          onClick={triggerApiError}
          className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded block"
        >
          Trigger API Error
        </button>

        {apiError && <div className="text-red-500">API error was triggered and captured by Sentry!</div>}
      </div>
    </div>
  );
}
