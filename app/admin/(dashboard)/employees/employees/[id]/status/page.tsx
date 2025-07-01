// Add force-static export configuration for static builds
export const dynamic = "force-static";
export const revalidate = false;

export default function StaticPlaceholder() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Static Placeholder</h1>
      <p className="text-gray-500">
        This is a static placeholder for a dynamic route.
        In the native app, this page will be dynamically generated.
      </p>
    </div>
  );
}