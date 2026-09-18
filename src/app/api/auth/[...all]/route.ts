import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Better Auth's endpoints: starting Google sign-in, Google's callback,
// reading the session, and signing out.

function notConfigured() {
  return new Response("Sign-in isn't set up on this site.", { status: 404 });
}

export async function GET(request: Request) {
  const auth = getAuth();
  return auth ? toNextJsHandler(auth).GET(request) : notConfigured();
}

export async function POST(request: Request) {
  const auth = getAuth();
  return auth ? toNextJsHandler(auth).POST(request) : notConfigured();
}
