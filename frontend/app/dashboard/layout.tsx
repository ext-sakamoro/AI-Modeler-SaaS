'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <Link href="/" className="text-lg font-bold">AI Modeler</Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink href="/dashboard/projects" active={pathname === '/dashboard/projects'}>Projects</NavLink>
          <NavLink href="/dashboard/editor" active={pathname === '/dashboard/editor'}>Editor</NavLink>
          <NavLink href="/dashboard/export" active={pathname === '/dashboard/export'}>Export</NavLink>
          <NavLink href="/dashboard/settings" active={pathname === '/dashboard/settings'}>Settings</NavLink>
          <NavLink href="/dashboard/billing" active={pathname === '/dashboard/billing'}>Billing</NavLink>
        </nav>
        <div className="p-4 border-t border-border space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
          >
            Sign Out
          </button>
          <p className="text-xs text-muted-foreground">ALICE-SDF v1.1.0</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {children}
    </Link>
  );
}
