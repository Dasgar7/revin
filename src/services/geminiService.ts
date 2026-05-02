import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

export async function* vibeCodeStream(
  prompt: string,
  history: { role: 'user' | 'model'; text: string }[],
  isCustomThemeMode: boolean = false
) {
  const aiClient = getGemini();

  const contents = [...history, { role: 'user' as const, text: prompt }].map((msg) => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));

  const systemInstruction = isCustomThemeMode
    ? "You are Revin, an elite AI web developer. The user has requested a custom theme generation. Your goal is ONLY to generate the color palette of the theme.\n\nCRITICAL RULES:\n1. Wrap your thoughts in <think> ... </think> tags BEFORE writing any code.\n2. Provide the code in a single markdown block with // file: App.tsx at the top.\n3. DO NOT build a full UI, functional app, or complex layout. Your code MUST ONLY be a simple, minimalist React component that displays the generated color palette (e.g., color swatches with hex codes).\n4. The interface should just be a presentation of the colors, using Tailwind CSS inline classes to set the background colors of the swatches.\n5. Output an engaging chat reply alongside the thought and code blocks."
    : "You are Revin, an elite AI web developer. The user will ask you to build an application or website.\n\nYou must build a FULLY FUNCTIONAL, complete, and stunning React application.\n\nCRITICAL RULES:\n1. ABSOLUTELY NO CLI COMMANDS. Do NOT output `npm install`, `mkdir`, `npx create-react-app`, or any terminal commands. This is strictly forbidden.\n2. You are operating in a Sandpack React IDE. The environment is already set up with React, framer-motion, lucide-react, and Tailwind CSS.\n3. Wrap all your planning, thoughts, and to-do lists inside <think> ... </think> tags BEFORE writing any code.\n4. Output each file in a separate markdown code block (e.g. ```tsx ... ```). Do NOT output code outside of a code block.\n5. The first line inside each code block MUST be a comment with the exact file destination, e.g., // file: App.tsx, // file: components/Button.tsx, // file: types.ts\n6. You MUST always provide a complete, working `App.tsx` file as the main entry point.\n7. Provide COMPLETE code. Never use placeholders. Implement all necessary UI, logic, and state. Use stunning, modern design with Tailwind CSS.";

  const responseStream = await aiClient.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
    },
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
