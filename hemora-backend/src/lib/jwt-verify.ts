import { jwtVerify, importJWK } from "jose";
import { prisma } from "./prisma.js";

/**
 * Decoded Supabase JWT payload.
 */
export interface SupabaseJWTPayload {
  sub: string;
  email: string;
  iss: string;
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

  const jwksResponse = await fetch(`${process.env.SUPABASE_URL!}/auth/v1/.well-known/jwks.json`);
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

  // Verify JWT — find the matching key by kid and import it
  const jwksKeys = await getJwks();
  const tokenHeader = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
  const matchingKey = jwksKeys.find((k: any) => k.kid === tokenHeader.kid);
  if (!matchingKey) {
    throw new Error("No matching JWK found for token kid: " + tokenHeader.kid);
  }
  const cryptoKey = await importJWK(matchingKey, "ES256");
  const verified = await jwtVerify(token, cryptoKey);

  const payload = verified.payload as unknown as SupabaseJWTPayload;

  // Validate issuer claim — reject tokens from unexpected Supabase projects
  // Supabase appends "/auth/v1" to the project URL in the issuer claim,
  // so use startsWith() instead of strict equality.
  const expectedIssuer = process.env.SUPABASE_URL;
  if (expectedIssuer && !payload.iss.startsWith(expectedIssuer)) {
    throw new Error("Invalid token issuer");
  }

  // Validate audience claim — reject tokens not intended for authenticated users
  if (payload.aud !== "authenticated") {
    throw new Error("Invalid token audience");
  }

  // Check user cache first
  const cached = userCache.get(payload.sub);
  if (cached && Date.now() < cached.expiresAt) {
    return { payload, user: cached.user };
  }

  // Look up user in our database for role info using Prisma.
  // If no DB record exists, auto-create a minimal record so the user can
  // authenticate and then complete registration via POST /users/self.
  // This prevents account lockout when Supabase Auth succeeds but the
  // database record was never created (e.g. admin-created Supabase users).
  let user: NonNullable<VerifyResult["user"]>;
  try {
    let dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!dbUser) {
      // Auto-create a minimal user record from JWT claims
      const email = payload.email;
      const nameFromToken = (verified.payload as any).user_metadata?.name || email.split("@")[0] || "User";
      dbUser = await prisma.user.create({
        data: {
          id: payload.sub,
          email,
          name: nameFromToken,
          role: "DONOR",
        },
      });
      console.log(`Auto-created user record for ${email} (id: ${payload.sub})`);
    }

    user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name ?? undefined,
      role: dbUser.role ?? undefined,
      facilityId: dbUser.facilityId ?? undefined,
      bloodGroup: dbUser.bloodGroup ?? undefined,
    };
  } catch (err: any) {
    // For DB connection issues or other errors, return 401
    console.error("User lookup/creation failed:", err.message || err);
    throw new Error("Authentication failed");
  }

  // Cache the result
  userCache.set(payload.sub, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });

  return { payload, user };
}
