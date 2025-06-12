export const metadata = {
  title: "Set up Two-Factor Authentication",
  description: "Set up MFA for your admin account",
};

// This is a root layout, so it will NOT inherit from /admin/layout.tsx
export default function SetupMFALayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  );
} 