import { jwtVerify } from "jose";
import { supabaseAdmin } from "./supabase.js";
import { prisma } from "./prisma.js";

/**
 * Decoded Supabase JWT payload.
 */
export interface SupabaseJWTPayload {
  sub: string;
  email: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Result of verifying a Bearer token from an Authorization header.
 */
export interface VerifyResult {
  payload: SupabaseJWTPayload;
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    facilityId?: string;
    bloodGroup?: string;
  } | null;
}

// Cache JWKs to avoid fetching on every request
let cachedJwks: { keys: any[]; expiresAt: number } | null = null;

// Cache user lookups to avoid hitting Supabase on every request
// TTL: 5 minutes — user role changes are rare and don't need real-time precision
const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const userCache = new Map<string, { user: NonNullable<VerifyResult["user"]>; expiresAt: number }>();

async function getJwks() {
  if (cachedJwks && Date.now() < cachedJwks.expiresAt) {
    return cachedJwks.keys;
  }

  const jwksResponse = await fetch(`${process.env.SUPABASE_URL!}/.well-known/jwks.json`);
  if (!jwksResponse.ok) {
    throw new Error("Failed to fetch Supabase JWKs");
  }
  const jwksData = await jwksResponse.json();

  // Cache for 1 hour
  cachedJwks = {
    keys: jwksData.keys,
    expiresAt: Date.now() + 3600 * 1000,
  };

  return cachedJwks.keys;
}

/**
 * Extracts the Bearer token from an Authorization header, verifies the JWT
 * signature against Supabase's public JWKs, and looks up the user in the DB.
 */
export async function verifyAuthHeader(authHeader: string): Promise<VerifyResult> {
  // Extract token
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new Error("Missing authorization token");
  }

  // Get JWKs from Supabase (cached)
  const jwksKeys = await getJwks();

  // Verify JWT
  const verified = await jwtVerify(token, async () => {
    const keys = await getJwks();
    return keys[0] as any;
  });

  const payload = verified.payload as unknown as SupabaseJWTPayload;

  // Check user cache first
  const cached = userCache.get(payload.sub);
  if (cached && Date.now() < cached.expiresAt) {
    return { payload, user: cached.user };
  }

  // Look up user in our database for role info
  let user: NonNullable<VerifyResult["user"]>;
  try {
    const { data } = await supabaseAdmin
      .from("user")
      .select("id, email, name, role, facilityId, bloodGroup")
      .eq("id", payload.sub)
      .single();

    if (data) {
      user = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        facilityId: data.facilityId,
        bloodGroup: data.bloodGroup,
      };
    } else {
      // User not found in DB — auto-sync by creating a minimal record
      // This closes the auth-to-DB sync gap for users whose sign-up backend call failed
      try {
        const dbUser = await prisma.user.create({
          data: {
            id: payload.sub,
            email: payload.email,
            name: payload.email.split("@")[0],
            role: "DONOR",
          },
        });
        console.log(`[Auth Sync] Auto-created DB record for user ${payload.sub}`);
        user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          facilityId: dbUser.facilityId ?? undefined,
          bloodGroup: dbUser.bloodGroup ?? undefined,
        };
      } catch (syncError) {
        // If auto-create fails (e.g., unique constraint conflict), fall back to minimal profile
        console.warn(`[Auth Sync] Failed to auto-create DB record for user ${payload.sub}:`, syncError);
        user = {
          id: payload.sub,
          email: payload.email,
          role: "DONOR",
        };
      }
    }
  } catch {
    // User not found in DB — auto-sync by creating a minimal record
    try {
      const dbUser = await prisma.user.create({
        data: {
          id: payload.sub,
          email: payload.email,
          name: payload.email.split("@")[0],
          role: "DONOR",
        },
      });
      console.log(`[Auth Sync] Auto-created DB record for user ${payload.sub}`);
      user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        facilityId: dbUser.facilityId ?? undefined,
        bloodGroup: dbUser.bloodGroup ?? undefined,
      };
    } catch (syncError) {
      console.warn(`[Auth Sync] Failed to auto-create DB record for user ${payload.sub}:`, syncError);
      user = {
        id: payload.sub,
        email: payload.email,
        role: "DONOR",
      };
    }
  }

  // Cache the result
  userCache.set(payload.sub, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });

  return { payload, user };
}
