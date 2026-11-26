CREATE TABLE "LoginThrottle" (
 key text PRIMARY KEY,
 failures integer NOT NULL DEFAULT 0,
 "windowStartedAt" timestamp(3) NOT NULL DEFAULT now(),
 "lockedUntil" timestamp(3),
 "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);
REVOKE ALL ON "LoginThrottle" FROM hospital_branch_runtime;
