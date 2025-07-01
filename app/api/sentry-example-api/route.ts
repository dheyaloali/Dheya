export const dynamic = "force-dynamic";
// A faulty API route to test Sentry's error monitoring
export async function GET() {
  // This is a placeholder API route with Sentry disabled
  return new Response(
    JSON.stringify({
      message: "Sentry example API is disabled for Capacitor compatibility",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
