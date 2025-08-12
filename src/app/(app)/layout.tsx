import { SessionProvider } from "next-auth/react";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";

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
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </SessionProvider>
  );
}
