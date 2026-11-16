import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ideasOutputSchema, textOutputSchema, type ModelCall } from "./schema";

// Rascunhos de texto não precisam do modelo mais caro: o Sonnet escreve bem e custa uma fração.
const MODEL = "claude-sonnet-5-5";

export const anthropicModelCall: ModelCall = async ({ prompt, kind, useSearch }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");
  const client = new Anthropic({ apiKey });
  const isIdea = kind === "IDEA";
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: isIdea ? 3000 : 6000,
    ...(useSearch ? { tools: [{ type: "web_search_20260209" as const, name: "web_search", max_uses: 3 }] } : {}),
    output_config: { format: zodOutputFormat(isIdea ? ideasOutputSchema : textOutputSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  const usage = { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 };
  const parsed = response.parsed_output;
  return isIdea ? { ideas: (parsed as never) ?? null, text: null, usage } : { ideas: null, text: (parsed as never) ?? null, usage };
};
