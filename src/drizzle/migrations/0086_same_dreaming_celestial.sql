DROP INDEX "idx_membership_upgrades_original_payment_id";--> statement-breakpoint
DROP INDEX "idx_membership_upgrades_upgrade_payment_id";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_membership_upgrades_original_payment_id" ON "membership_upgrades" USING btree ("original_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_membership_upgrades_upgrade_payment_id" ON "membership_upgrades" USING btree ("upgrade_payment_id");