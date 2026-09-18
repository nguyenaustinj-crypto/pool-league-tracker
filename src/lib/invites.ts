import { headers } from "next/headers";
import { hashInviteToken, isWellFormedInviteToken } from "@/lib/invite-token";
import type { LeagueRoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export interface ResolvedInvite {
  leagueId: string;
  leagueName: string;
  role: LeagueRoleName;
  /** Set for a one-time manager invite; null for a league's player link. */
  managerInviteId: string | null;
}

/**
 * What an invite link's token opens: a league's reusable player link, or a
 * one-time manager invite that hasn't been used or expired. Null otherwise.
 */
export async function resolveInvite(token: string): Promise<ResolvedInvite | null> {
  if (!isWellFormedInviteToken(token)) return null;

  const league = await prisma.league.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true },
  });
  if (league) {
    return { leagueId: league.id, leagueName: league.name, role: "PLAYER", managerInviteId: null };
  }

  const invite = await prisma.managerInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { league: { select: { name: true } } },
  });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) return null;
  return {
    leagueId: invite.leagueId,
    leagueName: invite.league.name,
    role: "MANAGER",
    managerInviteId: invite.id,
  };
}

/** This site's own address, for building links people can share. */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
