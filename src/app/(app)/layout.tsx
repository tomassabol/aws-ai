import { SessionProvider } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { Button } from "~/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <SessionProvider session={session}>
      <TRPCReactProvider>
        <div className="min-h-svh flex flex-col">
          <header className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="text-secondary-foreground">AWS AI Chat</span>
              </Link>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/api/auth/signout"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign Out
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </header>
          {children}
        </div>
      </TRPCReactProvider>
    </SessionProvider>
  );
}
