import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nichesTable = pgTable("niches", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  description: text("description").notNull(),
  audience: text("audience").notNull(),
  contentAngle: text("content_angle").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const providerSettingsTable = pgTable("provider_settings", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull().default("OpenAI compatible"),
  model: text("model").notNull().default("gpt-4o"),
  baseUrl: text("base_url"),
  apiKeyConfigured: boolean("api_key_configured").notNull().default(false),
  apiKeyLastFour: text("api_key_last_four"),
  realAnalysisEnabled: boolean("real_analysis_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const reelAnalysesTable = pgTable("reel_analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  nicheId: integer("niche_id").references(() => nichesTable.id, { onDelete: "set null" }),
  reelUrl: text("reel_url"),
  reelNotes: text("reel_notes").notNull(),
  concept: text("concept").notNull(),
  status: text("status").notNull().default("completed"),
  summaryPrompt: text("summary_prompt").notNull(),
  providerMode: text("provider_mode").notNull().default("demo"),
  sourceType: text("source_type").notNull().default("original"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promptPacksTable = pgTable("prompt_packs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  nicheId: integer("niche_id").references(() => nichesTable.id, { onDelete: "set null" }),
  analysisId: integer("analysis_id").notNull().references(() => reelAnalysesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  concept: text("concept").notNull(),
  storySummaryAr: text("story_summary_ar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scenePromptsTable = pgTable("scene_prompts", {
  id: serial("id").primaryKey(),
  promptPackId: integer("prompt_pack_id").notNull().references(() => promptPacksTable.id, { onDelete: "cascade" }),
  sceneNumber: integer("scene_number").notNull(),
  sceneType: text("scene_type").notNull(),
  title: text("title").notNull(),
  imagePrompt: text("image_prompt").notNull(),
  animationPrompt: text("animation_prompt").notNull(),
  voiceOverDarija: text("voice_over_darija").notNull(),
  soundEffectsPrompt: text("sound_effects_prompt").notNull(),
  sceneSummaryAr: text("scene_summary_ar"),
  sceneFrameUrl: text("scene_frame_url"),
});

export const frameSessionsTable = pgTable("frame_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  videoName: text("video_name").notNull(),
  videoDurationMs: integer("video_duration_ms").notNull(),
  videoWidth: integer("video_width").notNull().default(0),
  videoHeight: integer("video_height").notNull().default(0),
  frameCount: integer("frame_count").notNull(),
  frames: text("frames").notNull(),
  mode: text("mode").notNull().default("count"),
  quality: text("quality").notNull().default("0.92"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiSystemPromptsTable = pgTable("ai_system_prompts", {
  id: serial("id").primaryKey(),
  systemKey: text("system_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  modelOverride: text("model_override"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userApiKeysTable = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  keyType: text("key_type").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").notNull().default("Reel Prompt Studio"),
  siteLocked: boolean("site_locked").notNull().default(false),
  lockedMessage: text("locked_message").default("الموقع مغلق مؤقتاً، يرجى المحاولة لاحقاً"),
  registrationMode: text("registration_mode").notNull().default("open"),
  inviteCode: text("invite_code"),
  contactEmail: text("contact_email"),
  contactTwitter: text("contact_twitter"),
  contactInstagram: text("contact_instagram"),
  contactWhatsapp: text("contact_whatsapp"),
  contactWebsite: text("contact_website"),
  footerText: text("footer_text"),
  announcementSliderDuration: integer("announcement_slider_duration").notNull().default(5),
  forceDemoMode: boolean("force_demo_mode").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── New AI Provider System ───────────────────────────────────────────────────

export const aiProvidersTable = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'openrouter' | 'custom'
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const aiProviderModelsTable = pgTable("ai_provider_models", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => aiProvidersTable.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(), // e.g. "openai/gpt-4o", "meta-llama/llama-3.1-70b-instruct"
  label: text("label").notNull(), // display name
  capabilities: text("capabilities").notNull().default("analysis"), // comma-separated: "analysis,images,vision"
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiServiceAssignmentsTable = pgTable("ai_service_assignments", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull().unique(), // 'video-analysis','remix','story-summary','image-generation'
  modelId: integer("model_id").references(() => aiProviderModelsTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAiProviderSchema = createInsertSchema(aiProvidersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiProviderModelSchema = createInsertSchema(aiProviderModelsTable).omit({ id: true, createdAt: true });
export type AiProvider = typeof aiProvidersTable.$inferSelect;
export type AiProviderModel = typeof aiProviderModelsTable.$inferSelect;
export type AiServiceAssignment = typeof aiServiceAssignmentsTable.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title"),
  content: text("content"),
  variant: text("variant").notNull().default("info"),
  placement: text("placement").notNull().default("top"),
  size: text("size").notNull().default("md"),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  showTo: text("show_to").notNull().default("all"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNicheSchema = createInsertSchema(nichesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProviderSettingsSchema = createInsertSchema(providerSettingsTable).omit({ id: true, updatedAt: true });
export const insertReelAnalysisSchema = createInsertSchema(reelAnalysesTable).omit({ id: true, createdAt: true });
export const insertPromptPackSchema = createInsertSchema(promptPacksTable).omit({ id: true, createdAt: true });
export const insertScenePromptSchema = createInsertSchema(scenePromptsTable).omit({ id: true });
export const insertAiSystemPromptSchema = createInsertSchema(aiSystemPromptsTable).omit({ id: true, updatedAt: true });

export type InsertNiche = z.infer<typeof insertNicheSchema>;
export type Niche = typeof nichesTable.$inferSelect;
export type ProviderSettings = typeof providerSettingsTable.$inferSelect;
export type ReelAnalysis = typeof reelAnalysesTable.$inferSelect;
export type PromptPack = typeof promptPacksTable.$inferSelect;
export type ScenePrompt = typeof scenePromptsTable.$inferSelect;
export type AiSystemPrompt = typeof aiSystemPromptsTable.$inferSelect;
