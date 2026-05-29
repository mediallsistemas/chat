-- Rename notifications tables to use notif_ prefix convention.
ALTER TABLE "notification_settings" RENAME TO "notif_settings";
ALTER TABLE "push_subscriptions" RENAME TO "notif_push_subscriptions";
ALTER TABLE "notifications" RENAME TO "notif_notifications";
