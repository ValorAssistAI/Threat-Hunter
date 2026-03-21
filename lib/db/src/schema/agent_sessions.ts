import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("idle"),
  conversationId: integer("conversation_id").references(() => conversations.id, {
    onDelete: "set null",
  }),
  scopeInTargets: text("scope_in_targets").notNull().default("[]"),
  scopeOutTargets: text("scope_out_targets").notNull().default("[]"),
  conditions: text("conditions").notNull().default(""),
  objectives: text("objectives").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const toolInvocations = pgTable("tool_invocations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => agentSessions.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  toolInput: text("tool_input").notNull().default("{}"),
  toolOutput: text("tool_output").notNull().default("{}"),
  scopeAllowed: boolean("scope_allowed").notNull().default(true),
  scopeReason: text("scope_reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAgentSessionSchema = createInsertSchema(agentSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  conversationId: true,
  status: true,
});

export type AgentSession = typeof agentSessions.$inferSelect;
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;
export type ToolInvocation = typeof toolInvocations.$inferSelect;
