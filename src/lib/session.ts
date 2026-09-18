import { cache } from "react";
import { headers } from "next/headers";
import { isAdminEmail } from "@/lib/admins";
import { getAuth } from "@/lib/auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
}

/** The signed-in user for this request, or null if nobody is signed in. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const auth = getAuth();
  if (!auth) return null;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    isAdmin: isAdminEmail(user.email, user.emailVerified, process.env.ADMIN_EMAILS),
  };
});
