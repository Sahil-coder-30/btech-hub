import { logger } from "faultkit";
import type { BaseLanguageModelInput, StructuredOutputMethodOptions } from "@langchain/core/language_models/base";
import { BaseChatModel, type BaseChatModelCallOptions, type BindToolsInput } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { RunnableLambda, type Runnable, type RunnableConfig } from "@langchain/core/runnables";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { interopSafeParseAsync, type InteropZodType } from "@langchain/core/utils/types";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { agentProvider, embeddingModel, embeddingProvider, geminiModel, llmProvider, nvidiaEmbeddingModel, nvidiaModelName, requireEnv } from "../env";

/** Any of our chat models. The first signature keeps the zod schema's type on structured output. */
export type ChatModel = {
  withStructuredOutput<T extends Record<string, any>>(schema: InteropZodType<T>, config?: StructuredOutputMethodOptions<false>): Runnable<BaseLanguageModelInput, T>;
} & BaseChatModel;

function geminiChat(temperature: number, maxRetries: number) {
  return new ChatGoogleGenerativeAI({ model: geminiModel(), apiKey: requireEnv("GEMINI_API_KEY"), temperature, maxRetries });
}

/**
 * Main chat model. Lower temperature for tools and grading, higher for creative tasks.
 * NVIDIA by default, with Gemini as its backup. LLM_PROVIDER=gemini uses Gemini alone.
 */
export function chatModel(temperature = 0.3, maxRetries = 2): ChatModel {
  if (llmProvider() === "gemini") return geminiChat(temperature, maxRetries);
  // No retries on the backup: a busy Gemini fails fast instead of holding the request for minutes
  return new ChatNvidia({ temperature, fallback: () => geminiChat(temperature, 0) });
}

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_TIMEOUT_MS = 45_000;

type OpenAITool = ReturnType<typeof convertToOpenAITool>;
type NvidiaFields = { temperature: number; model?: string; thinking?: boolean; fallback?: () => BaseChatModel; tools?: OpenAITool[]; toolChoice?: string };
type NvidiaToolCall = { id: string; function: { name: string; arguments: string } };

const ROLES: Record<string, string> = { system: "system", human: "user", ai: "assistant" };

/** LangChain message to the OpenAI format. PDF parts are not supported, so those calls go to the backup. */
function toNvidiaMessage(message: BaseMessage) {
  // The agent loop: the model's tool calls, then one tool message with each result
  if (ToolMessage.isInstance(message)) return { role: "tool", tool_call_id: message.tool_call_id, content: contentToText(message.content) };
  if (AIMessage.isInstance(message) && message.tool_calls?.length) {
    return {
      role: "assistant",
      content: contentToText(message.content),
      tool_calls: message.tool_calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })),
    };
  }
  const role = ROLES[message.getType()] ?? "user";
  if (typeof message.content === "string") return { role, content: message.content };
  const content = (message.content as Record<string, any>[]).map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image_url") return { type: "image_url", image_url: { url: typeof part.image_url === "string" ? part.image_url : part.image_url.url } };
    throw new Error(`NVIDIA models cannot read "${part.type}" content.`);
  });
  return { role, content };
}

/** Text deltas from an OpenAI style server-sent event stream. */
async function* streamDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      const text = JSON.parse(data).choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  }
}

/**
 * Nemotron on NVIDIA's hosted API. Any failure before the answer starts (quota, overload,
 * timeout, bad tool call) retries the same request on the backup model.
 */
class ChatNvidia extends BaseChatModel {
  private fields: NvidiaFields;

  constructor(fields: NvidiaFields) {
    super({});
    this.fields = fields;
  }

  _llmType() {
    return "nvidia";
  }

  override bindTools(tools: BindToolsInput[], kwargs?: Partial<BaseChatModelCallOptions>) {
    const converted = tools.map((tool) => convertToOpenAITool(tool));
    // withStructuredOutput binds one tool and expects it to be called
    const forced = typeof kwargs?.tool_choice === "string" ? kwargs.tool_choice : converted.length === 1 ? converted[0].function.name : undefined;
    return new ChatNvidia({ ...this.fields, tools: converted, toolChoice: forced });
  }

  private async request(messages: BaseMessage[], signal: AbortSignal | undefined, stream: boolean) {
    const { temperature, tools, toolChoice } = this.fields;
    const timeout = AbortSignal.timeout(NVIDIA_TIMEOUT_MS);
    const res = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${requireEnv("NVIDIA_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.fields.model ?? nvidiaModelName(),
        messages: messages.map(toNvidiaMessage),
        temperature,
        max_tokens: 8192,
        stream,
        // Nemotron thinks before it answers by default. Off keeps replies to a few seconds.
        chat_template_kwargs: { enable_thinking: this.fields.thinking ?? false },
        ...(tools ? { tools, tool_choice: toolChoice ? { type: "function", function: { name: toolChoice } } : "auto" } : {}),
      }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!res.ok) {
      const error = new Error(`NVIDIA request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      Object.assign(error, { status: res.status });
      throw error;
    }
    return res;
  }

  private backup(err: unknown, signal: AbortSignal | undefined) {
    if (!this.fields.fallback || signal?.aborted) throw err;
    logger.warn({ err }, "NVIDIA failed, using the backup model");
    const model = this.fields.fallback();
    return this.fields.tools ? model.bindTools!(this.fields.tools, { tool_choice: this.fields.toolChoice }) : model;
  }

  /**
   * The base implementation returns the raw tool arguments without checking the schema, so a
   * reply that skips a field (e.g. a quiz question with no `options`) would reach the UI.
   * Validate here and hand a bad reply to the backup, whose parser validates on its own.
   */
  override withStructuredOutput(schema: any, config?: any): any {
    const raw = super.withStructuredOutput(schema, config);
    if (config?.includeRaw) return raw;
    return RunnableLambda.from(async (input: BaseLanguageModelInput, options?: Partial<RunnableConfig>) => {
      let problem: unknown;
      try {
        const parsed = await interopSafeParseAsync(schema, await raw.invoke(input, options));
        if (parsed.success) return parsed.data;
        problem = new Error(`NVIDIA reply did not match the "${config?.name ?? "output"}" schema.`);
      } catch (err) {
        problem = err;
      }
      if (!this.fields.fallback || options?.signal?.aborted) throw problem;
      logger.warn({ err: problem }, "NVIDIA structured output failed, using the backup model");
      return this.fields.fallback().withStructuredOutput(schema, config).invoke(input, options);
    });
  }

  async _generate(messages: BaseMessage[], options: this["ParsedCallOptions"]): Promise<ChatResult> {
    let message: AIMessageChunk;
    try {
      const data = await (await this.request(messages, options.signal, false)).json();
      const reply = data.choices?.[0]?.message ?? {};
      message = new AIMessageChunk({
        content: reply.content ?? "",
        tool_calls: ((reply.tool_calls ?? []) as NvidiaToolCall[]).map((call) => ({
          id: call.id,
          name: call.function.name,
          args: JSON.parse(call.function.arguments || "{}"),
          type: "tool_call" as const,
        })),
      });
      if (this.fields.toolChoice && !message.tool_calls?.length) throw new Error("NVIDIA returned no tool call.");
    } catch (err) {
      const reply = await this.backup(err, options.signal).invoke(messages, { signal: options.signal });
      message = new AIMessageChunk({ content: reply.content, tool_calls: reply.tool_calls });
    }
    return { generations: [{ text: contentToText(message.content), message }] };
  }

  async *_streamResponseChunks(messages: BaseMessage[], options: this["ParsedCallOptions"]): AsyncGenerator<ChatGenerationChunk> {
    let started = false;
    try {
      const res = await this.request(messages, options.signal, true);
      for await (const text of streamDeltas(res.body!)) {
        started = true;
        yield new ChatGenerationChunk({ text, message: new AIMessageChunk({ content: text }) });
      }
      return;
    } catch (err) {
      // Half an answer cannot be continued by another model
      if (started) throw err;
      for await (const chunk of await this.backup(err, options.signal).stream(messages, { signal: options.signal })) {
        const text = contentToText(chunk.content);
        if (text) yield new ChatGenerationChunk({ text, message: new AIMessageChunk({ content: text }) });
      }
    }
  }
}

/**
 * Model for the Vac agent. It makes several calls per chat turn. NVIDIA (NVIDIA_AGENT_MODEL, else
 * NVIDIA_MODEL) with thinking on and Gemini as the backup. AGENT_PROVIDER=gemini uses chatModel.
 */
export function agentModel(temperature = 0.3): ChatModel {
  if (agentProvider() === "gemini") return chatModel(temperature);
  return new ChatNvidia({
    temperature,
    model: process.env.NVIDIA_AGENT_MODEL || nvidiaModelName(),
    // Without thinking the agent skipped tools (no resource links, made up CGPA maths, claimed to save memories)
    thinking: process.env.NVIDIA_AGENT_THINKING !== "false",
    fallback: () => geminiChat(temperature, 0),
  });
}

type Embedder = { embedQuery: (text: string) => Promise<number[]>; embedDocuments: (texts: string[]) => Promise<number[][]> };

/** NVIDIA embeddings (nemotron embed, cut to 1024 dims to fit the Pinecone index). */
async function nvidiaEmbed(texts: string[], inputType: "query" | "passage"): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const res = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${requireEnv("NVIDIA_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: nvidiaEmbeddingModel(),
        input: texts.slice(i, i + 64),
        input_type: inputType,
        encoding_format: "float",
        truncate: "END",
        dimensions: 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const error = new Error(`NVIDIA embeddings failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      Object.assign(error, { status: res.status });
      throw error;
    }
    const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    out.push(...data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return out;
}

const nvidiaEmbedder: Embedder = {
  // NVIDIA's safety screen sometimes rejects plain syllabus text (422) and fails the whole batch.
  // Retry one by one; a rejected chunk gets an empty vector and callers skip it.
  embedDocuments: (texts) =>
    nvidiaEmbed(texts, "passage").catch((err) => {
      if ((err as { status?: number }).status !== 422) throw err;
      return Promise.all(texts.map((t) => nvidiaEmbed([t], "passage").then((v) => v[0], () => [] as number[])));
    }),
  embedQuery: async (text) => (await nvidiaEmbed([text], "query"))[0],
};

let geminiEmbedder: GoogleGenerativeAIEmbeddings | null = null;

/**
 * Embeddings for documents and search queries (EMBEDDING_PROVIDER). Both providers give 1024 dims,
 * but their vectors are not comparable, so each one has its own Pinecone namespace.
 */
export function embedder(): Embedder {
  if (embeddingProvider() === "nvidia") return nvidiaEmbedder;
  if (!geminiEmbedder) {
    geminiEmbedder = new GoogleGenerativeAIEmbeddings({
      model: embeddingModel(),
      apiKey: requireEnv("GEMINI_API_KEY"),
      outputDimensionality: 1024,
    });
  }
  return geminiEmbedder;
}

/** LangChain message content can be a string or a list of parts. This returns plain text. */
export function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part && typeof part === "object" && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
}
