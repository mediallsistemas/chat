-- Rename tickets tables to use tkt_ prefix convention.
ALTER TABLE "tickets" RENAME TO "tkt_tickets";
ALTER TABLE "ticket_comments" RENAME TO "tkt_comments";
