import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  experimental_createMCPClient,
  type ToolSet,
} from "ai";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { env } from "~/env";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMCPClient } from "./_lib/create-mcp";

export async function POST(req: Request) {
  const body = await req.json();
  const {
    messages,
    model,
    stage,
  }: { messages: UIMessage[]; model?: string; stage: "prod" | "test" } = body;

  const [awsProdMCP, awsTestMCP] = await Promise.all([
    createMCPClient({
      url: env.MCP_PROD_URL,
      apiKey: env.MCP_API_KEY,
    }),
    createMCPClient({
      url: env.MCP_TEST_URL,
      apiKey: env.MCP_API_KEY,
    }),
  ]);

  const [awsProdTools, awsTestTools] = await Promise.all([
    awsProdMCP.tools(),
    awsTestMCP.tools(),
  ]);

  const tools: ToolSet = stage === "prod" ? awsProdTools : awsTestTools;

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  const summarizeToolOutputs = (outputs: unknown[]): string => {
    const texts: string[] = [];
    for (const out of outputs) {
      const content = (out as any)?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === "text" && typeof c?.text === "string") {
            texts.push(c.text);
          }
        }
      }
    }

    let parsedJson: unknown = undefined;
    for (const t of texts) {
      try {
        parsedJson = JSON.parse(t);
        break;
      } catch {
        // continue
      }
    }

    const makeTableFromArray = (arr: unknown[]): string | null => {
      const maxRows = 10;
      if (arr.length === 0) return "Found 0 items.";
      if (
        typeof arr[0] === "object" &&
        arr[0] !== null &&
        !Array.isArray(arr[0])
      ) {
        const objects = arr.slice(0, maxRows) as Array<Record<string, unknown>>;
        const primaryKeys = Object.keys(objects[0] ?? {}).slice(0, 4);
        if (primaryKeys.length === 0) {
          const rows = objects.map((o) => `- ${JSON.stringify(o)}`).join("\n");
          return [`Found ${arr.length} items.`, "", rows].join("\n");
        }
        const header = `| ${primaryKeys.join(" | ")} |`;
        const sep = `| ${primaryKeys.map(() => "---").join(" | ")} |`;
        const rows = objects
          .map((o) => {
            const cols = primaryKeys.map((k) => {
              const v = o[k];
              if (v == null) return "-";
              if (
                typeof v === "string" ||
                typeof v === "number" ||
                typeof v === "boolean"
              ) {
                return String(v);
              }
              return "…";
            });
            return `| ${cols.join(" | ")} |`;
          })
          .join("\n");
        const more =
          arr.length > objects.length
            ? `\n\n…and ${arr.length - objects.length} more.`
            : "";
        return [`Found ${arr.length} items.`, "", header, sep, rows, more].join(
          "\n"
        );
      }
      const rows = arr
        .slice(0, maxRows)
        .map((v) => `- ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join("\n");
      const more =
        arr.length > maxRows ? `\n\n…and ${arr.length - maxRows} more.` : "";
      return [`Found ${arr.length} items.`, "", rows, more].join("\n");
    };

    const tryArrayLikeFromObject = (
      obj: Record<string, unknown>
    ): unknown[] | null => {
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          return value as unknown[];
        }
      }
      return null;
    };

    if (Array.isArray(parsedJson)) {
      const table = makeTableFromArray(parsedJson);
      if (table) return table;
    } else if (parsedJson && typeof parsedJson === "object") {
      const arr = tryArrayLikeFromObject(parsedJson as Record<string, unknown>);
      if (arr) {
        const table = makeTableFromArray(arr);
        if (table) return table;
      }
    }

    const compact = texts.join("\n").trim();
    if (!compact) return "";
    const lines = compact.split(/\n+/).filter(Boolean).slice(0, 10);
    return [
      "Here is a concise summary:",
      "",
      ...lines.map((l) => `- ${l}`),
    ].join("\n");
  };

  const result = streamText({
    model: openai(model ?? "gpt-4o"),
    messages: convertToModelMessages(messages),
    system: [
      "You are an AWS-savvy assistant.",
      "When you call tools, always produce a clear, human-readable final answer.",
      "Do not dump raw JSON. Summarize the results in concise prose with markdown.",
      "For list-like data, prefer a small table with a few key columns.",
      "If there are many items, show a short summary (counts) and up to 10 examples unless the user asks for more.",
      "Use bullet lists or tables where helpful; keep output skimmable.",
    ].join("\n"),
    tools,
    experimental_transform: () => {
      let emittedText = false;
      const outputs: unknown[] = [];

      return new TransformStream<any, any>({
        transform(
          part: any,
          controller: TransformStreamDefaultController<any>
        ) {
          if (part?.type === "text-delta") {
            emittedText = true;
          } else if (part?.type === "tool-input-start") {
            // Do not inject text here; UI renders a dedicated tool block
          } else if (part?.type === "tool-result") {
            outputs.push(part.output);
          } else if (
            part?.type === "finish" &&
            !emittedText &&
            outputs.length
          ) {
            const summary = summarizeToolOutputs(outputs);
            if (summary) {
              const id = `sum-${Math.random().toString(36).slice(2, 8)}`;
              controller.enqueue({ type: "text-start", id });
              controller.enqueue({ type: "text-delta", id, text: summary });
              controller.enqueue({ type: "text-end", id });
            }
          }
          controller.enqueue(part);
        },
      });
    },
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}

export type OpenAiModels = Parameters<OpenAIProvider>[0];
