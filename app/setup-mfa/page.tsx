"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SetupMfaPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.user.email }),
      })
        .then((res) => res.json())
        .then((data) => {
          setQrCode(data.qrCodeDataUrl);
          setSecret(data.secret);
        });
    }
  }, [session]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: session?.user?.email, token: code }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setSuccess("MFA setup complete! Please log in again.");
      setTimeout(() => signOut({ callbackUrl: "/login" }), 2000);
    } else {
      setError(data.error || "Invalid code. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-sm p-4 bg-white rounded shadow-lg border border-gray-200">
        <h1 className="text-lg font-semibold mb-4 text-center">Set up Two-Factor Authentication</h1>
        {qrCode && (
          <>
            <div className="flex justify-center mb-2">
              <img src={qrCode} alt="Scan this QR code" className="mx-auto" style={{ width: 120, height: 120 }} />
            </div>
            <p className="mb-1 text-center text-sm">Scan this QR code with your authenticator app.</p>
            <div className="mb-2 text-center break-all">
              <span className="block text-xs text-muted-foreground mb-1">Or enter this code manually:</span>
              <span className="font-mono font-bold text-xs break-all inline-block max-w-full bg-gray-100 px-1 py-0.5 rounded">{secret}</span>
            </div>
          </>
        )}
        <form onSubmit={handleVerify}>
          <label className="block mb-1 text-sm">Enter the 6-digit code from your app:</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full border px-2 py-1 mb-1 rounded text-sm"
            maxLength={6}
            required
          />
          {error && <div className="text-red-500 mb-1 text-xs">{error}</div>}
          {success && <div className="text-green-600 mb-1 text-xs">{success}</div>}
          <button type="submit" className="w-full bg-blue-600 text-white py-1.5 rounded text-sm mt-1">Verify & Enable MFA</button>
        </form>
      </div>
    </div>
  );
} 