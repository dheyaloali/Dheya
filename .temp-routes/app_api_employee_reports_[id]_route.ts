// This is a static placeholder for a dynamic route
// It will be replaced with the actual file after the build
export const dynamic = "force-static";
export const revalidate = false;

// For API routes
export async function GET() {
  return new Response(JSON.stringify({ message: 'Static placeholder' }), {
    headers: { 'content-type': 'application/json' },
  });
}