-- Nodes with their own no-log DNS resolver: clients use it instead of public resolvers.
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "privateDns" BOOLEAN NOT NULL DEFAULT false;
