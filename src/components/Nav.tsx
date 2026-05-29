"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/Providers";

const LINKS = [
  { href: "/closet", label: "Closet" },
  { href: "/outfits/new", label: "Build" },
  { href: "/outfits/generate", label: "Generate" },
];

export function Nav() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl leading-none tracking-tight">
            Virtual <em className="not-italic text-ink-muted">Closet</em>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                  active ? "bg-ink text-surface" : "text-ink/70 hover:bg-surface-sunken hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          {loading ? null : user ? (
            <>
              <span className="hidden text-ink-muted md:inline">{user.email}</span>
              <button
                onClick={async () => { await signOut(); router.push("/login"); }}
                className="btn-ghost"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
