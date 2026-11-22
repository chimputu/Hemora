import {
    importJWK,
    jwtVerify,
    createRemoteJWKSet,
} from "jose";

// Google OAuth2/OIDC discovery URL
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_ISSUER_ALT = "accounts.google.com";

// Cache the remote JWK set
let googleJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getGoogleJWKS() {
    if (!googleJWKS) {
        googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));
    }
    return googleJWKS;
}

export interface GoogleTokenPayload {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    picture?: string;
    aud: string;
    iss: string;
    exp: number;
    iat: number;
}

/**
 * Verify a Google ID token and return the decoded payload.
 *
 * This function:
 * 1. Verifies the JWT signature using Google's public signing keys (JWKS).
 * 2. Validates the issuer is Google.
 * 3. Validates the audience matches the expected Google client ID.
 * 4. Validates the token has not expired.
 * 5. Validates the email is verified by Google.
 *
 * @param idToken - The Google ID token (JWT string)
 * @param expectedAudience - The Google OAuth client ID registered for HEMORA
 * @returns The decoded token payload if valid
 * @throws If the token is invalid, expired, or from an untrusted issuer
 */
export async function verifyGoogleIdToken(
    idToken: string,
    expectedAudience: string,
): Promise<GoogleTokenPayload> {
    if (!idToken) {
        throw new Error("ID token is required");
    }

    if (!expectedAudience) {
        throw new Error(
            "GOOGLE_CLIENT_ID is not configured. Set it in your .env file.",
        );
    }

    try {
        const jwks = getGoogleJWKS();

        const verification = await jwtVerify<GoogleTokenPayload>(
            idToken,
            jwks,
            {
                issuer: GOOGLE_ISSUER,
                audience: expectedAudience,
            },
        );

        const payload = verification.payload;

        // Double-check issuer (in case jose doesn't strictly enforce it)
        if (
            payload.iss !== GOOGLE_ISSUER &&
            payload.iss !== GOOGLE_ISSUER_ALT
        ) {
            throw new Error("Invalid token issuer");
        }

        // Ensure the email is verified by Google
        if (!payload.email_verified) {
            throw new Error("Google email is not verified");
        }

        return payload;
    } catch (error: any) {
        // Re-throw with a cleaner message
        if (error.code === "ERR_JWT_EXPIRED") {
            throw new Error("Google ID token has expired");
        }
        if (error.code === "ERR_JWT_INVALID_SIGNATURE") {
            throw new Error("Invalid Google ID token signature");
        }
        if (error.code === "ERR_JWT_INVALID_AUDIENCE") {
            throw new Error(
                "Google ID token audience does not match expected client ID",
            );
        }
        throw error;
    }
}
