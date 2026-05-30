-- Rename chat tables to use chat_ prefix convention.
ALTER TABLE "groups" RENAME TO "chat_groups";
ALTER TABLE "group_members" RENAME TO "chat_group_members";
ALTER TABLE "messages" RENAME TO "chat_messages";
ALTER TABLE "message_reactions" RENAME TO "chat_message_reactions";
