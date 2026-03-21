import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agentSessions, conversations, messages, toolInvocations } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { MessageParam, ToolUseBlock, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  CreateAgentSessionBody,
  SendAgentMessageBody,
} from "@workspace/api-zod";
import { AGENT_TOOLS, executeTool } from "../lib/agent-tools";
import { checkScope, type ScopeDefinition } from "../lib/scope";

const router: IRouter = Router();

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16000;
const THINKING_BUDGET = 10000;
const MAX_AGENTIC_ITERATIONS = 20;

function buildSystemPrompt(session: typeof agentSessions.$inferSelect): string {
  const inTargets = JSON.parse(session.scopeInTargets) as string[];
  const outTargets = JSON.parse(session.scopeOutTargets) as string[];

  return `You are ArnieAI, an autonomous security analysis agent specializing in vulnerability assessment, threat intelligence, and red team support.

## PENTEST SCOPE DEFINITION

**Session:** ${session.name}
**Objectives:** ${session.objectives}

**IN SCOPE:**
${inTargets.length > 0 ? inTargets.map((t) => `  - ${t}`).join("\n") : "  - All AWS resources in the connected account (973028704465, us-east-1)"}

**OUT OF SCOPE:**
${outTargets.length > 0 ? outTargets.map((t) => `  - ${t}`).join("\n") : "  - None specified"}

**CONDITIONS & CONSTRAINTS:**
${session.conditions || "  - Standard read-only security assessment. No destructive operations. No lateral movement outside defined scope."}

## OPERATING PRINCIPLES

1. **Scope enforcement is absolute.** You MUST NOT invoke any tool against a resource that is not in scope. The system validates scope before execution — denied calls are logged.
2. **Think before acting.** Use extended reasoning to plan your approach before calling tools.
3. **Be methodical.** Start with a summary, then drill into high-severity findings, correlate across data sources (GuardDuty + Inspector + Security Hub), and check threat intel.
4. **Document findings clearly.** When you identify something significant, describe: what it is, why it matters, CVSS/severity context, and recommended remediation.
5. **VirusTotal lookups** are always permitted for IOC enrichment.
6. **Operate autonomously** until you have a complete picture or reach a natural stopping point, then summarize your findings.

## CONNECTED AWS INFRASTRUCTURE
- Account: 973028704465, Region: us-east-1
- GuardDuty detector active
- Inspector v2 enabled (EC2, ECR, Lambda)
- Security Hub active (default standards)
- S3 bucket: arnievulnai-artifacts (folders: reports, scan-results, audit, samples, threat-intel)
- CloudWatch log groups: /arnievulnai/audit, /arnievulnai/scan-results, /arnievulnai/threat-intel, /arnievulnai/tool-invocations`;
}

function getScope(session: typeof agentSessions.$inferSelect): ScopeDefinition {
  return {
    inTargets: JSON.parse(session.scopeInTargets) as string[],
    outTargets: JSON.parse(session.scopeOutTargets) as string[],
    conditions: session.conditions,
  };
}

function sseWrite(res: import("express").Response, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function runAgentLoop(
  session: typeof agentSessions.$inferSelect,
  chatMessages: MessageParam[],
  convId: number,
  sessionId: number,
  res: import("express").Response
): Promise<void> {
  const scope = getScope(session);
  let iterations = 0;

  while (iterations < MAX_AGENTIC_ITERATIONS) {
    iterations++;

    sseWrite(res, { type: "thinking", content: `Iteration ${iterations}/${MAX_AGENTIC_ITERATIONS}...` });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: {
        type: "enabled",
        budget_tokens: THINKING_BUDGET,
      },
      system: buildSystemPrompt(session),
      tools: AGENT_TOOLS,
      messages: chatMessages,
    });

    // Collect assistant message content
    const assistantContent: MessageParam["content"] = response.content;
    chatMessages.push({ role: "assistant", content: assistantContent });

    // Stream thinking blocks and text blocks to client
    for (const block of response.content) {
      if (block.type === "thinking") {
        sseWrite(res, { type: "thinking_block", content: block.thinking });
      } else if (block.type === "text" && block.text) {
        sseWrite(res, { type: "text", content: block.text });
        // Save to DB
        await db.insert(messages).values({
          conversationId: convId,
          role: "assistant",
          content: block.text,
        });
      }
    }

    // If stop reason is end_turn or max_tokens, we're done
    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
      break;
    }

    // Process tool calls
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
      const toolResults: ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const input = (toolUse.input ?? {}) as Record<string, unknown>;
        const scopeCheck = checkScope(toolUse.name, input, scope);

        // Log the invocation attempt
        const [invocationRecord] = await db.insert(toolInvocations).values({
          sessionId,
          toolName: toolUse.name,
          toolInput: JSON.stringify(input),
          toolOutput: scopeCheck.allowed ? "" : JSON.stringify({ error: scopeCheck.reason }),
          scopeAllowed: scopeCheck.allowed,
          scopeReason: scopeCheck.reason,
        }).returning();

        if (!scopeCheck.allowed) {
          // Blocked by scope — notify client and return error to Claude
          sseWrite(res, {
            type: "tool_blocked",
            toolName: toolUse.name,
            toolId: toolUse.id,
            reason: scopeCheck.reason,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error: `SCOPE VIOLATION: ${scopeCheck.reason}. This tool invocation was blocked and logged.`,
            }),
            is_error: true,
          });
          continue;
        }

        // Execute the tool
        sseWrite(res, { type: "tool_call", toolName: toolUse.name, toolId: toolUse.id, input });

        let toolOutput: unknown;
        let isError = false;
        try {
          toolOutput = await executeTool(toolUse.name, input);
        } catch (err) {
          toolOutput = { error: String(err) };
          isError = true;
        }

        const outputStr = JSON.stringify(toolOutput);

        // Update the DB record with the output
        await db.update(toolInvocations)
          .set({ toolOutput: outputStr })
          .where(eq(toolInvocations.id, invocationRecord.id));

        sseWrite(res, { type: "tool_result", toolName: toolUse.name, toolId: toolUse.id, result: toolOutput });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: outputStr,
          is_error: isError,
        });
      }

      // Add tool results to the conversation and continue
      chatMessages.push({ role: "user", content: toolResults });
    }
  }

  if (iterations >= MAX_AGENTIC_ITERATIONS) {
    sseWrite(res, { type: "text", content: `\n\n---\n**Agent reached maximum iterations (${MAX_AGENTIC_ITERATIONS}). Analysis complete.**` });
  }
}

// List sessions
router.get("/agent/sessions", async (_req, res): Promise<void> => {
  try {
    const sessions = await db.select().from(agentSessions).orderBy(agentSessions.createdAt);
    res.json(sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Create session
router.post("/agent/sessions", async (req, res): Promise<void> => {
  const parsed = CreateAgentSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, scopeInTargets, scopeOutTargets, conditions, objectives } = parsed.data;

  try {
    const [session] = await db.insert(agentSessions).values({
      name,
      scopeInTargets: JSON.stringify(scopeInTargets),
      scopeOutTargets: JSON.stringify(scopeOutTargets ?? []),
      conditions: conditions ?? "",
      objectives,
    }).returning();

    res.status(201).json({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get session detail
router.get("/agent/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  try {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    const sessionMessages = session.conversationId
      ? await db.select().from(messages).where(eq(messages.conversationId, session.conversationId)).orderBy(messages.createdAt)
      : [];

    const invocations = await db.select().from(toolInvocations)
      .where(eq(toolInvocations.sessionId, id))
      .orderBy(toolInvocations.createdAt);

    res.json({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: sessionMessages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
      toolInvocations: invocations.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete session
router.delete("/agent/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  try {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    await db.delete(agentSessions).where(eq(agentSessions.id, id));
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// List tool invocations
router.get("/agent/sessions/:id/tool-invocations", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  try {
    const invocations = await db.select().from(toolInvocations)
      .where(eq(toolInvocations.sessionId, id))
      .orderBy(toolInvocations.createdAt);
    res.json(invocations.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Autonomous run — SSE stream
router.post("/agent/sessions/:id/run", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  try {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create or reuse conversation
    let convId = session.conversationId;
    if (!convId) {
      const [conv] = await db.insert(conversations).values({ title: session.name }).returning();
      convId = conv.id;
      await db.update(agentSessions)
        .set({ conversationId: convId, status: "running", updatedAt: new Date() })
        .where(eq(agentSessions.id, id));
    } else {
      await db.update(agentSessions)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(agentSessions.id, id));
    }

    // Build initial prompt
    const initPrompt = `Begin your autonomous security analysis now. Your objectives are:

${session.objectives}

Start by getting a dashboard summary, then systematically investigate all findings within scope. Correlate findings across GuardDuty, Inspector, and Security Hub. Use VirusTotal to enrich any suspicious IOCs. Review relevant S3 artifacts and CloudWatch logs if needed. Produce a structured findings report when complete.`;

    await db.insert(messages).values({ conversationId: convId, role: "user", content: initPrompt });
    sseWrite(res, { type: "started", sessionId: id });

    const chatMessages: MessageParam[] = [{ role: "user", content: initPrompt }];
    await runAgentLoop(session, chatMessages, convId, id, res);

    // Mark complete
    await db.update(agentSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(agentSessions.id, id));

    sseWrite(res, { type: "done", sessionId: id });
    res.end();
  } catch (err) {
    sseWrite(res, { type: "error", content: String(err) });
    res.end();
  }
});

// Send message to agent — SSE stream
router.post("/agent/sessions/:id/message", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = SendAgentMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create conversation if needed
    let convId = session.conversationId;
    if (!convId) {
      const [conv] = await db.insert(conversations).values({ title: session.name }).returning();
      convId = conv.id;
      await db.update(agentSessions)
        .set({ conversationId: convId, updatedAt: new Date() })
        .where(eq(agentSessions.id, id));
    }

    // Load existing messages for context
    const existingMessages = await db.select().from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(messages.createdAt);

    const chatMessages: MessageParam[] = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Add user message
    const userContent = parsed.data.content;
    await db.insert(messages).values({ conversationId: convId, role: "user", content: userContent });
    chatMessages.push({ role: "user", content: userContent });

    await db.update(agentSessions)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(agentSessions.id, id));

    await runAgentLoop(session, chatMessages, convId, id, res);

    await db.update(agentSessions)
      .set({ status: "idle", updatedAt: new Date() })
      .where(eq(agentSessions.id, id));

    sseWrite(res, { type: "done" });
    res.end();
  } catch (err) {
    sseWrite(res, { type: "error", content: String(err) });
    res.end();
  }
});

export default router;
