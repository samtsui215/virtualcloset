"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/Providers";
import { GoogleButton } from "@/components/GoogleButton";

export default function LoginPage() {
  const router = useRouter();
  const { signInEmail, signInGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInEmail(email, password);
      router.push("/closet");
    } catch {
      setError("Invalid email or password");
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInGoogle();
      router.push("/closet");
    } catch {
      setError("Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <div className="card w-full p-8">
        <h1 className="font-display text-4xl leading-tight tracking-tight">
          Welcome <em className="text-ink-muted">back.</em>
        </h1>
        <p className="mt-2 text-sm text-ink-muted">Sign in to your wardrobe.</p>

        <div className="mt-8 space-y-4">
          <GoogleButton onClick={google} disabled={busy} label="Continue with Google" />

          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-ink-subtle">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <button disabled={busy} className="btn-primary w-full">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          New here?{" "}
          <Link href="/register" className="font-medium text-ink underline-offset-4 hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
