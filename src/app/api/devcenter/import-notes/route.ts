import { NextRequest, NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth/session";
import { serverSecrets, MOCK_MODE } from "@/lib/env";

export interface ProposedTask {
  title: string;
  business_goal: string;
  description: string;
  module_affected: string;
  who_uses_it: string;
  priority: "low" | "medium" | "high" | "urgent";
  risk_level: "low" | "medium" | "high" | "critical";
  success_criteria: string;
  notes: string;
}

export interface ImportResult {
  tasks: ProposedTask[];
  rawSummary: string;
  error?: string;
}

const MODULES = [
  "Dashboard","Incidents","CAPA","OSHA Logs","Risk Intelligence",
  "Audits & Assessments","Training & Competency","Documents & Programs",
  "Chemical Management","Biosafety & Lab Safety","Waste Management",
  "Ergonomics & MSD","Monitoring & Equipment","Legal Register",
  "AI Safety Assistant","Reports & Analytics","Workspace",
  "Team & Settings","Admin Console","AI Dev Command Center",
  "AI Gateway","ARC Module","Database","Platform Operations","Other",
];

export async function POST(req: NextRequest) {
  if (MOCK_MODE) {
    return NextResponse.json<ImportResult>({
      tasks: [
        {
          title: "Add CSV export to Incidents page",
          business_goal: "Save safety managers time pulling reports",
          description: "Add an Export button to the Incidents page that downloads a spreadsheet.",
          module_affected: "Incidents",
          who_uses_it: "Safety managers",
          priority: "medium",
          risk_level: "low",
          success_criteria: "Clicking Export downloads a CSV with all incidents.",
          notes: "Demo task — connect Supabase for real import.",
        },
      ],
      rawSummary: "Demo mode — this is a sample extracted task.",
    });
  }

  if (!(await isSuperadmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "docx", "doc"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Only PDF and Word (.docx) files are supported." }, { status: 400 });
  }

  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 20 MB." }, { status: 400 });
  }

  const { anthropicKey, anthropicModel } = serverSecrets();
  if (!anthropicKey) return NextResponse.json({ error: "AI API key not configured." }, { status: 500 });

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: anthropicKey });

  const systemPrompt = `You are a software project manager assistant for SafetyIQ, an EHS (Environmental Health & Safety) platform built with Next.js, Supabase, and Tailwind CSS.

You will be given meeting notes, a requirements document, or a brainstorming document. Your job is to extract every distinct software development task mentioned or implied and structure them as actionable dev tasks.

For each task, output:
- title: short imperative (e.g. "Add CSV export to Incidents page")
- business_goal: why this matters to the user / business
- description: what needs to be built, in plain English
- module_affected: one of: ${MODULES.join(", ")}
- who_uses_it: which user types benefit
- priority: "low" | "medium" | "high" | "urgent"
- risk_level: "low" | "medium" | "high" | "critical"
- success_criteria: how you'd know it's done
- notes: anything else relevant, or empty string

Extract ALL tasks — even minor ones like UI tweaks, bug fixes, or small feature requests. If something is vague, make a reasonable interpretation and note it in the notes field.

Also output a rawSummary: 2-3 sentences summarizing what the document was about.

Output ONLY valid JSON: { "tasks": [...], "rawSummary": "..." }`;

  try {
    let response;

    if (ext === "pdf") {
      // Anthropic natively supports PDF — send as document block
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (client.messages.create as any)({
        model: anthropicModel || "claude-sonnet-4-6",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: "Extract all development tasks from this document and return the JSON." },
            ],
          },
        ],
        tools: [
          {
            name: "submit_tasks",
            description: "Submit the extracted tasks",
            input_schema: {
              type: "object" as const,
              required: ["tasks", "rawSummary"],
              properties: {
                rawSummary: { type: "string" },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["title","business_goal","description","module_affected","who_uses_it","priority","risk_level","success_criteria","notes"],
                    properties: {
                      title:            { type: "string" },
                      business_goal:    { type: "string" },
                      description:      { type: "string" },
                      module_affected:  { type: "string" },
                      who_uses_it:      { type: "string" },
                      priority:         { type: "string", enum: ["low","medium","high","urgent"] },
                      risk_level:       { type: "string", enum: ["low","medium","high","critical"] },
                      success_criteria: { type: "string" },
                      notes:            { type: "string" },
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: "any" as const },
      });
    } else {
      // DOCX — extract text with mammoth, then send as text
      const bytes = await file.arrayBuffer();
      const mammoth = await import("mammoth");
      const { value: docText } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });

      if (!docText.trim()) {
        return NextResponse.json({ error: "Could not extract text from the document. Make sure it isn't a scanned image." }, { status: 400 });
      }

      response = await client.messages.create({
        model: anthropicModel || "claude-sonnet-4-6",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here are the meeting notes / document contents:\n\n${docText.slice(0, 40000)}\n\nExtract all development tasks and return the JSON.`,
          },
        ],
        tools: [
          {
            name: "submit_tasks",
            description: "Submit the extracted tasks",
            input_schema: {
              type: "object" as const,
              required: ["tasks", "rawSummary"],
              properties: {
                rawSummary: { type: "string" },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["title","business_goal","description","module_affected","who_uses_it","priority","risk_level","success_criteria","notes"],
                    properties: {
                      title:            { type: "string" },
                      business_goal:    { type: "string" },
                      description:      { type: "string" },
                      module_affected:  { type: "string" },
                      who_uses_it:      { type: "string" },
                      priority:         { type: "string", enum: ["low","medium","high","urgent"] },
                      risk_level:       { type: "string", enum: ["low","medium","high","critical"] },
                      success_criteria: { type: "string" },
                      notes:            { type: "string" },
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: "any" as const },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (response.content as any[]).find((b: any) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "AI did not return structured output. Try again." }, { status: 500 });
    }

    const result = toolUse.input as ImportResult;
    return NextResponse.json<ImportResult>(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
