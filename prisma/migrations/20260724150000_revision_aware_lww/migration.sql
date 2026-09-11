-- Record whether a Change won server-side LWW. Losing versions remain available
-- to recovery clients without being mistaken for canonical pull state.
ALTER TABLE "Change" ADD COLUMN "accepted" BOOLEAN NOT NULL DEFAULT true;
