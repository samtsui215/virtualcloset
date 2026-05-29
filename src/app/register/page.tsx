"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/Providers";
import { GoogleButton } from "@/components/GoogleButton";

export default function RegisterPage() {
  const router = useRouter();
  const { signUpEmail, signInGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUpEmail(email, password, name || undefined);
      router.push("/closet");
    } catch (e) {
      // Firebase returns codes like auth/email-already-in-use
      const code = (e as { code?: string }).code ?? "";
      setError(code.includes("email-already-in-use") ? "That email is already registered" : "Registration failed");
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
          Start <em className="text-ink-muted">building.</em>
        </h1>
        <p className="mt-2 text-sm text-ink-muted">A wardrobe in a few clicks.</p>

        <div className="mt-8 space-y-4">
          <GoogleButton onClick={google} disabled={busy} label="Sign up with Google" />

          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-ink-subtle">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Name (optional)</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <button disabled={busy} className="btn-primary w-full">
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Have an account?{" "}
          <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
