"use client";

import { useState } from "react";
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
    <main className="min-h-screen bg-gradient-to-b from-background to-background/60">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-4 py-6">
        {/* Conversation */}
        <div className="flex min-h-0 flex-1 flex-col">
          <Conversation className="h-full">
            <ConversationContent className="p-4">
              {messages.length === 0 && (
                <div className="mx-auto my-8 max-w-2xl rounded-xl bg-background p-6 text-center">
                  <h2 className="text-lg font-semibold">
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

        {/* Input */}
        <div className="sticky bottom-3">
          <PromptInput onSubmit={handleSubmit} className="mt-2">
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              autoFocus
            />
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputModelSelect
                  value={model}
                  onValueChange={(value) =>
                    setModel(value as (typeof models)[number]["value"])
                  }
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
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
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {awsStages.map((stage) => (
                      <PromptInputModelSelectItem key={stage} value={stage}>
                        {stage}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit disabled={!input || isBusy} status={status} />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </main>
  );
}
