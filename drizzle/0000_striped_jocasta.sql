CREATE TYPE "public"."date_field" AS ENUM('Date_of_Birth', 'Anniversary_Date');--> statement-breakpoint
CREATE TYPE "public"."module" AS ENUM('Contacts', 'Leads', 'both');--> statement-breakpoint
CREATE TYPE "public"."send_status" AS ENUM('sent', 'failed', 'skipped_dupe', 'skipped_invalid');--> statement-breakpoint
CREATE TABLE "rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"module" "module" DEFAULT 'both' NOT NULL,
	"date_field" date_field DEFAULT 'Date_of_Birth' NOT NULL,
	"template_name" text NOT NULL,
	"template_lang" text DEFAULT 'en_US' NOT NULL,
	"has_name_var" boolean DEFAULT false NOT NULL,
	"has_header_image" boolean DEFAULT false NOT NULL,
	"header_image_url" text,
	"send_time" text DEFAULT '09:00' NOT NULL,
	"criteria_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_date" text NOT NULL,
	"rule_id" integer,
	"matched" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"deduped" integer DEFAULT 0 NOT NULL,
	"skipped_invalid" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer,
	"run_date" text NOT NULL,
	"recipient_name" text,
	"recipient_mobile" text NOT NULL,
	"template_name" text NOT NULL,
	"status" "send_status" NOT NULL,
	"wa_message_id" text,
	"error_code" text,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_summary" ADD CONSTRAINT "run_summary_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_log" ADD CONSTRAINT "send_log_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_recipient_per_run" ON "send_log" USING btree ("rule_id","run_date","recipient_mobile");--> statement-breakpoint
CREATE INDEX "send_log_run_date_idx" ON "send_log" USING btree ("run_date");--> statement-breakpoint
CREATE INDEX "send_log_status_idx" ON "send_log" USING btree ("status");