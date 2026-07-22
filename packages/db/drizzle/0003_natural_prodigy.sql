CREATE TABLE "usage_meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"ai_queries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_meters_tenant_period_uidx" UNIQUE("tenant_id","period")
);
--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_meters_tenant_idx" ON "usage_meters" USING btree ("tenant_id");--> statement-breakpoint

ALTER TABLE "usage_meters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_meters" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "usage_meters_isolation_policy" ON "usage_meters"
	TO "docvault_app"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);