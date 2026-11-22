-- Add custom authentication fields to User table
ALTER TABLE "user" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "user" ADD COLUMN "emailVerificationToken" TEXT;
ALTER TABLE "user" ADD COLUMN "emailVerificationExpires" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "user" ADD COLUMN "passwordResetExpires" TIMESTAMP(3);

-- Add default cuid() for user.id if not already set (for new users)
-- Existing users already have IDs, so we just need the default for future inserts.

-- Create RefreshToken table
CREATE TABLE "refresh_token" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- Create indexes for RefreshToken
CREATE INDEX "refresh_token_userId_idx" ON "refresh_token"("userId");
CREATE INDEX "refresh_token_tokenHash_idx" ON "refresh_token"("tokenHash");
CREATE INDEX "refresh_token_expiresAt_idx" ON "refresh_token"("expiresAt");

-- Add foreign key constraint
ALTER TABLE "refresh_token"
  ADD CONSTRAINT "refresh_token_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;
