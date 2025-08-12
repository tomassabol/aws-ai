"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { isToolUIPart, getToolName } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Message, MessageContent } from "~/components/ai-elements/message";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "~/components/ai-elements/prompt-input";
import { Response } from "~/components/ai-elements/response";
import { Loader } from "~/components/ai-elements/loader";
import { Suggestions, Suggestion } from "~/components/ai-elements/suggestion";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "~/components/ai-elements/source";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "~/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "~/components/ai-elements/tool";
import type { OpenAiModels } from "~/app/api/chat/route";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { InfoIcon } from "lucide-react";

const models = [
  { name: "GPT-4o", value: "gpt-4o" },
] as const satisfies ReadonlyArray<{
  name: string;
  value: OpenAiModels;
}>;

const starterSuggestions = [
  "What AWS service should I use for serverless APIs?",
  "Explain S3 vs EFS and when to choose each.",
  "Generate a Terraform snippet for an S3 bucket with versioning.",
  "Design a highly available architecture on AWS.",
] as const;

const awsStages = ["prod", "test"] as const;

type OptimisticTool = { id: string; name: string; input?: unknown };

export default function ChatBotDemo() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<(typeof models)[number]["value"]>(
    models[0].value
  );
  const [awsStage, setAwsStage] = useState<(typeof awsStages)[number]>("prod");
  const [optimisticTools, setOptimisticTools] = useState<OptimisticTool[]>([]);
  const { messages, sendMessage, status } = useChat({
    onToolCall: ({ toolCall }: any) => {
      const id: string =
        (toolCall && (toolCall.toolCallId || toolCall.id)) ||
        Math.random().toString(36).slice(2);
      const name: string = (toolCall && toolCall.toolName) || "tool";
      const inputVal = (toolCall &&
        (toolCall.input ?? toolCall.args)) as unknown;
      setOptimisticTools((prev) => {
        if (prev.some((t) => t.id === id)) return prev;
        return [...prev, { id, name, input: inputVal }];
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(
      { text: input },
      {
        body: { model, stage: awsStage },
      }
    );
    setInput("");
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(
      { text: suggestion },
      {
        body: { model, stage: awsStage },
      }
    );
  };

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <main className="relative flex-1 min-h-0 bg-background">
      {/* Decorative gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(520px_260px_at_0%_0%,theme(colors.indigo.500)/14,transparent_60%),radial-gradient(520px_260px_at_100%_0%,theme(colors.fuchsia.500)/12,transparent_60%),radial-gradient(700px_340px_at_50%_100%,theme(colors.emerald.500)/10,transparent_65%)]"
      />
      <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 px-4 pt-6 pb-32">
        {/* Conversation */}
        <div className="flex min-h-0 flex-1 flex-col">
          <Conversation className="h-full">
            <ConversationContent className="p-4">
              {messages.length === 0 && (
                <div className="mx-auto my-10 max-w-2xl rounded-xl bg-background/80 p-6 text-center">
                  <h2 className="text-xl font-semibold tracking-tight">
                    Welcome to AWS AI Chat
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start with a suggested prompt or ask your own question.
                  </p>
                  <div className="mt-4">
                    <Suggestions>
                      {starterSuggestions.map((s) => (
                        <Suggestion
                          key={s}
                          suggestion={s}
                          onClick={handleSuggestion}
                        />
                      ))}
                    </Suggestions>
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    Tip: You can switch the model and AWS stage below.
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === "assistant" && (
                    <Sources>
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case "source-url":
                            return (
                              <>
                                <SourcesTrigger
                                  count={
                                    message.parts.filter(
                                      (p) => p.type === "source-url"
                                    ).length
                                  }
                                />
                                <SourcesContent key={`${message.id}-${i}`}>
                                  <Source
                                    key={`${message.id}-${i}`}
                                    href={part.url}
                                    title={part.url}
                                  />
                                </SourcesContent>
                              </>
                            );
                          default:
                            return null;
                        }
                      })}
                    </Sources>
                  )}

                  <Message from={message.role}>
                    <MessageContent>
                      {message.role === "assistant" &&
                        (() => {
                          const existingToolIds = new Set(
                            message.parts
                              .map((p: any) => (p as any)?.toolCallId)
                              .filter(Boolean)
                          );
                          const pending = optimisticTools.filter(
                            (t) => !existingToolIds.has(t.id)
                          );
                          if (pending.length === 0) return null;
                          return (
                            <div className="mb-2">
                              {pending.map((t) => (
                                <Tool key={`optimistic-${t.id}`}>
                                  <ToolHeader
                                    type={`tool-${t.name}`}
                                    state={"input-streaming" as any}
                                  />
                                  <ToolContent>
                                    <ToolInput input={t.input} />
                                  </ToolContent>
                                </Tool>
                              ))}
                            </div>
                          );
                        })()}
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case "text":
                            return (
                              <Response key={`${message.id}-${i}`}>
                                {part.text}
                              </Response>
                            );
                          case "reasoning":
                            return (
                              <Reasoning
                                key={`${message.id}-${i}`}
                                className="w-full"
                                isStreaming={status === "streaming"}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          default: {
                            // Render tool parts (static or dynamic) as a separate block
                            if (
                              isToolUIPart(part) ||
                              part.type === "dynamic-tool"
                            ) {
                              const toolLabel = isToolUIPart(part)
                                ? String(getToolName(part))
                                : ((part as any).toolName ?? "tool");
                              const state = (part as any).state;
                              const input = (part as any).input;
                              const output = (part as any).output;
                              const errorText = (part as any).errorText;

                              return (
                                <Tool key={`${message.id}-${i}`}>
                                  <ToolHeader
                                    type={`tool-${toolLabel}`}
                                    state={state}
                                  />
                                  <ToolContent>
                                    <ToolInput input={input} />
                                    <ToolOutput
                                      output={output}
                                      errorText={errorText}
                                    />
                                  </ToolContent>
                                </Tool>
                              );
                            }
                            return null;
                          }
                        }
                      })}
                    </MessageContent>
                  </Message>
                </div>
              ))}
              {status === "submitted" && <Loader className="mx-auto my-4" />}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* Input (fixed at bottom) */}
        <div className="fixed inset-x-0 bottom-3 z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-5xl px-4">
            <PromptInput onSubmit={handleSubmit} className="mt-2">
              <PromptInputTextarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
                autoFocus
                placeholder="Ask anything about AWS. Press Enter to send, Shift+Enter for a new line."
              />

              <PromptInputToolbar>
                <PromptInputTools>
                  <PromptInputModelSelect
                    value={model}
                    onValueChange={(value) =>
                      setModel(value as (typeof models)[number]["value"])
                    }
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PromptInputModelSelectTrigger>
                          <PromptInputModelSelectValue />
                        </PromptInputModelSelectTrigger>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Model</TooltipContent>
                    </Tooltip>
                    <PromptInputModelSelectContent>
                      {models.map((model) => (
                        <PromptInputModelSelectItem
                          key={model.value}
                          value={model.value}
                        >
                          {model.name}
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>
                  <PromptInputModelSelect
                    value={awsStage}
                    onValueChange={(value) =>
                      setAwsStage(value as (typeof awsStages)[number])
                    }
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PromptInputModelSelectTrigger>
                          <PromptInputModelSelectValue />
                        </PromptInputModelSelectTrigger>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>AWS Stage</TooltipContent>
                    </Tooltip>
                    <PromptInputModelSelectContent>
                      {awsStages.map((stage) => (
                        <PromptInputModelSelectItem key={stage} value={stage}>
                          {stage}
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>
                </PromptInputTools>
                <PromptInputSubmit
                  disabled={!input || isBusy}
                  status={status}
                />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </div>
    </main>
  );
}
