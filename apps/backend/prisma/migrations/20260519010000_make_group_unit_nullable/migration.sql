-- Allow groups.unit_id to be NULL so that direct (PRIVATE) chats are user-to-user, global.
ALTER TABLE "groups" ALTER COLUMN "unit_id" DROP NOT NULL;
