-- Rename meetings tables to use meet_ prefix convention.
ALTER TABLE "meetings" RENAME TO "meet_meetings";
ALTER TABLE "meeting_participants" RENAME TO "meet_participants";
