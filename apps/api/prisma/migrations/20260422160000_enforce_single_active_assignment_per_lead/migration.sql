CREATE UNIQUE INDEX "Assignment_leadId_active_status_key"
ON "Assignment" ("leadId")
WHERE "status" IN ('pending', 'assigned', 'accepted');
