import { createAuthClient } from "better-auth/react";

// Browser-side Better Auth client. Talks to /api/auth on this same site.
export const authClient = createAuthClient();
