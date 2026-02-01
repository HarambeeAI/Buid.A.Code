import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logtoClient } from "@/lib/logto";
import { AppLayout } from "@/components/layout";
import { NextRequest } from "next/server";

type User = {
  id: string;
  email: string;
  name: string | null;
  tier: "FREE" | "PRO";
  analyses_remaining: number | null;
  role: "USER" | "ADMIN";
};

async function getUser(): Promise<User | null> {
  try {
    // Create a mock request with cookies for Logto
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const mockRequest = new NextRequest("http://localhost:3000", {
      headers: {
        cookie: cookieHeader,
      },
    });

    const context = await logtoClient.getLogtoContext(mockRequest);

    if (!context.isAuthenticated || !context.claims) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { logto_user_id: context.claims.sub },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        analyses_remaining: true,
        role: true,
      },
    });

    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return <AppLayout user={user}>{children}</AppLayout>;
}
