"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/Providers";

const LINKS = [
  { href: "/closet", label: "Closet" },
  { href: "/outfits", label: "Outfits" },
  { href: "/outfits/new", label: "Build" },
  { href: "/outfits/generate", label: "Generate" },
];

function linkClass(active: boolean) {
  return `rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition ${
    active ? "bg-ink text-surface" : "text-ink/70 hover:bg-surface-sunken hover:text-ink"
  }`;
}

export function Nav() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const signOutAndRedirect = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <span className="font-display text-2xl leading-none tracking-tight">
            Virtual <em className="not-italic text-ink-muted">Closet</em>
          </span>
        </Link>

        {/* Inline links on desktop */}
        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(pathname === l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 text-sm">
          {loading ? null : user ? (
            <>
              <span className="hidden text-ink-muted md:inline">{user.email}</span>
              <button onClick={signOutAndRedirect} className="btn-ghost">Sign out</button>
            </>
          ) : (
            <Link href="/login" className="btn-primary">Sign in</Link>
          )}
        </div>
      </div>

      {/* Always-visible link row on mobile — scrolls horizontally if it overflows */}
      <nav className="flex items-center gap-1.5 overflow-x-auto border-t border-line/70 px-4 py-2 sm:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(pathname === l.href)}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
