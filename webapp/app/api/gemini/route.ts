import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { formatMenuForPrompt, pizzaMenu } from "@/data/menu";

const requestSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
  address: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      line1: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
});

const orderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().optional(),
  notes: z.string().optional(),
});

const orderSchema = z.object({
  items: z.array(orderItemSchema),
  subtotal: z.number().optional(),
  taxes: z.number().optional(),
  fees: z.number().optional(),
  total: z.number().optional(),
  specialInstructions: z.string().optional(),
  confirmationPrompt: z.string().optional(),
});

const geminiResponseSchema = z.object({
  assistantMessage: z.string(),
  requiresClarification: z.boolean().optional(),
  clarifications: z.array(z.string()).optional(),
  order: orderSchema.optional(),
});

const DEFAULT_MODEL = "gemini-2.5-pro-exp-0827";
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, history, address } = parsed.data;

  try {
    if (!GEMINI_KEY) {
      throw new Error(
        "Missing GEMINI_API_KEY. Add it to call the Gemini 2.5 computer-use model."
      );
    }

    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_COMPUTER_USE_MODEL ?? DEFAULT_MODEL,
    });

    const prompt = buildPrompt(history, message, address);

    const result = await model.generateContent({
      contents: prompt,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });

    const rawText = result.response.text();

    const parsedResponse = safeParseGemini(rawText);

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("Gemini API error", error);
    const fallback = buildFallbackResponse(message);
    return NextResponse.json(fallback, {
      status: GEMINI_KEY ? 200 : 503,
    });
  }
}

function buildPrompt(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  latestMessage: string,
  address?: { name?: string; line1?: string; city?: string; state?: string; postalCode?: string }
) {
  const transcript = history
    .map((entry) => `${entry.role === "user" ? "Customer" : "Assistant"}: ${entry.content}`)
    .join("\n");

  const menuText = formatMenuForPrompt();

  const addressText = address?.line1
    ? `Current delivery details: ${address.line1}, ${address.city ?? ""}, ${
        address.state ?? ""
      } ${address.postalCode ?? ""}.`
    : "Delivery address not provided yet.";

  const systemInstruction = `You are an ordering specialist for Outta Sight Pizza (thatsouttasight.com). ` +
    `Translate the customer's natural language into the official menu items listed below. ` +
    `Respond ONLY with JSON following this TypeScript interface:\n\n` +
    `interface OrderResponse {\n` +
    `  assistantMessage: string; // conversational response\n` +
    `  requiresClarification?: boolean;\n` +
    `  clarifications?: string[]; // specific questions to ask\n` +
    `  order?: {\n` +
    `    items: Array<{ id: string; name: string; quantity: number; price?: number; notes?: string }>;\n` +
    `    subtotal?: number;\n` +
    `    taxes?: number;\n` +
    `    fees?: number;\n` +
    `    total?: number;\n` +
    `    specialInstructions?: string;\n` +
    `    confirmationPrompt?: string;\n` +
    `  };\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Always choose the closest menu item.\n` +
    `- If quantity is missing, assume 1.\n` +
    `- Ask clarifying questions if the request is ambiguous or references unavailable items.\n` +
    `- Include a friendly assistantMessage summarizing the interpreted order.\n` +
    `- Total should include subtotal + taxes + fees when possible. If uncertain, omit it.\n` +
    `- Never invent menu items not listed.\n` +
    `- Mention when an item is unavailable.`;

  const latest = `Customer: ${latestMessage}`;

  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text:
            `${systemInstruction}\n\nMenu:\n${menuText}\n\n${addressText}\n\nPrevious conversation (if any):\n${transcript}\n\n${latest}`,
        },
      ],
    },
  ];

  return contents;
}

function safeParseGemini(raw: string) {
  try {
    const json = JSON.parse(raw);
    return geminiResponseSchema.parse(json);
  } catch (error) {
    console.error("Failed to parse Gemini JSON", raw, error);
    return buildFallbackResponse("", true);
  }
}

function buildFallbackResponse(message: string, silent = false): z.infer<typeof geminiResponseSchema> {
  const normalized = message.toLowerCase();
  const matchedItems = pizzaMenu
    .flatMap((category) => category.items)
    .filter((item) => normalized.includes(item.name.toLowerCase()) || normalized.includes(item.id));

  if (matchedItems.length === 0) {
    return {
      assistantMessage: silent
        ? ""
        : "I couldn't map that to the menu yet. Could you name the pie or slice you're after?",
      requiresClarification: true,
      clarifications: ["Which pizza from the menu should I grab for you?"],
    };
  }

  const items = matchedItems.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: 1,
    price: item.price,
  }));

  const subtotal = items.reduce((total, item) => total + (item.price ?? 0) * item.quantity, 0);
  const taxes = Number((subtotal * 0.08875).toFixed(2));
  const total = Number((subtotal + taxes).toFixed(2));

  return {
    assistantMessage: silent
      ? ""
      : `I matched that to ${items.map((item) => `${item.quantity} ${item.name}`).join(", ")}. Let me know if that's right!`,
    order: {
      items,
      subtotal,
      taxes,
      total,
    },
  };
}
