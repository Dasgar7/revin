import express from "express";
import { GoogleGenAI } from "@google/genai";
import OpenAI, { toFile } from "openai";

const app = express();

app.use(express.json({ limit: "50mb" }));

app.post("/api/vibe-code", async (req, res) => {
    const { prompt, history, isCustomThemeMode, attachments } = req.body;

    const systemInstruction = isCustomThemeMode
      ? "You are Revin, an elite AI web developer. The user has requested a custom theme generation. Your goal is ONLY to generate the color palette of the theme.\n\nCRITICAL RULES:\n1. Wrap your thoughts in <think> ... </think> tags BEFORE writing any code.\n2. Provide the code in a single markdown block with // file: App.tsx at the top.\n3. DO NOT build a full UI, functional app, or complex layout. Your code MUST ONLY be a simple, minimalist React component that displays the generated color palette (e.g., color swatches with hex codes).\n4. The interface should just be a presentation of the colors, using Tailwind CSS inline classes to set the background colors of the swatches.\n5. Output an engaging chat reply alongside the thought and code blocks."
      : "You are Revin, an elite AI web developer with a keen eye for modern, beautiful, and highly interactive UX/UI design. The user will ask you to build an application or website.\n\nYou must build a FULLY FUNCTIONAL, complete, and visually stunning React application.\n\nCRITICAL RULES:\n1. ABSOLUTELY NO CLI COMMANDS. Do NOT output `npm install`, `mkdir`, `npx create-react-app`, or any terminal commands.\n2. Environment: Sandpack React IDE. Pre-installed: react, framer-motion, lucide-react, tailwindcss. ALWAYS import icons from 'lucide-react'.\n3. Wrap all planning inside <think> ... </think> tags BEFORE writing any code.\n4. Output EACH file in a separate markdown code block (e.g., ```tsx ... ```). The FIRST LINE of every code block MUST be the file path comment (e.g., // file: App.tsx). Do NOT put files in a src directory unless absolutely necessary, use the root path like App.tsx, styles.css, etc.\n5. You MUST provide a complete `App.tsx` file. Never use placeholders (like `// ... implement later`), write production-ready code.\n6. DESIGN GUIDELINES: Use modern design trends (Glassmorphism, Bento grids, Neo-brutalism). Extensively use Tailwind for hover states, smooth transitions (`transition-all duration-300`), gradients, drop shadows, and responsive layouts. Include animations using `framer-motion` (staggered list animations, page transitions, micro-interactions). Ensure high color contrast, beautiful typography, proper padding/margins, and a polished, premium feel.";

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    try {
      const mapMessageOpenAI = (msg: any) => {
        let content: any = msg.text || "";
        if (msg.attachments && msg.attachments.length > 0) {
          content = [];
          if (msg.text) content.push({ type: "text", text: msg.text });
          for (const att of msg.attachments) {
            if (att.mimeType.startsWith("image/")) {
              content.push({ type: "image_url", image_url: { url: att.url } });
            }
          }
        }
        return {
          role: msg.role === "model" ? "assistant" : "user",
          content,
        };
      };

      const baseMessages = [
        ...history.map(mapMessageOpenAI),
        mapMessageOpenAI({ role: "user", text: prompt, attachments })
      ];

      const messages = [
        { role: "system", content: systemInstruction },
        ...baseMessages
      ];

      const providers = [
        { name: "Groq", key: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
        { name: "OpenAI", key: process.env.OPENAI_API_KEY, baseURL: undefined, model: "gpt-4o" },
        { name: "Moonshot", key: process.env.MOONSHOOT_API_KEY, baseURL: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
        { name: "GLM", key: process.env.GLM_API_KEY, baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4" },
        { name: "OpenRouter", key: process.env.OpenRouter_API_KEY, baseURL: "https://openrouter.ai/api/v1", model: "anthropic/claude-3.7-sonnet" },
        { name: "xAI", key: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1", model: "grok-2-latest" },
        { name: "DeepSeek", key: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com", model: "deepseek-reasoner" }
      ];

      let streamSucceeded = false;

      for (const provider of providers) {
        if (!provider.key) continue;
        try {
          const openai = new OpenAI({ baseURL: provider.baseURL, apiKey: provider.key });
          const completion = await openai.chat.completions.create({
            model: provider.model,
            messages,
            stream: true,
          });

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content || "";
            const reasonerDelta = (chunk.choices[0]?.delta as any)?.reasoning_content || "";
            if (reasonerDelta) {
               res.write(`data: ${JSON.stringify({ text: reasonerDelta })}\n\n`);
            }
            if (delta) {
               res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
            }
          }
          streamSucceeded = true;
          break;
        } catch (err: any) {
          console.error(`${provider.name} failed:`, err.message);
        }
      }

      if (!streamSucceeded) {
        const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2;
        if (!key) throw new Error("No API key available across all providers");
        
        const ai = new GoogleGenAI({ apiKey: key });
        const contents = [...history, { role: "user", text: prompt, attachments }].map((msg: any) => {
            const parts: any[] = [];
            if (msg.text) parts.push({ text: msg.text });
            if (msg.attachments && msg.attachments.length > 0) {
               for (const att of msg.attachments) {
                  const base64Data = att.url.split(',')[1];
                  parts.push({ inlineData: { data: base64Data, mimeType: att.mimeType } });
               }
            }
            if (parts.length === 0) parts.push({ text: "" });
            
            return {
                role: msg.role === 'model' ? 'model' : 'user',
                parts,
            };
        });

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-pro',
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
            },
        });

        for await (const chunk of responseStream) {
            if (chunk.text) {
                res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
        }
      }
    } catch (e: any) {
      console.error(e);
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    } finally {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
});

app.post("/api/transcribe", async (req, res) => {
    try {
      const { base64Audio, mimeType } = req.body;

      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const file = await toFile(audioBuffer, "audio.webm", { type: mimeType || 'audio/webm' });

      if (process.env.GROQ_API_KEY) {
        try {
          const openai = new OpenAI({
              baseURL: "https://api.groq.com/openai/v1",
              apiKey: process.env.GROQ_API_KEY,
          });
          const transcription = await openai.audio.transcriptions.create({
              file: file,
              model: "whisper-large-v3",
          });
          return res.json({ text: transcription.text });
        } catch (err: any) {
          console.error("Groq transcription failed:", err.message);
        }
      }

      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
          });
          const transcription = await openai.audio.transcriptions.create({
              file: file,
              model: "whisper-1",
          });
          return res.json({ text: transcription.text });
        } catch (err: any) {
          console.error("OpenAI transcription failed:", err.message);
        }
      }
      
      const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2;
      if (!key) throw new Error("No API key available for transcription");
      const ai = new GoogleGenAI({ apiKey: key });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Audio,
                  mimeType: mimeType || 'audio/webm',
                },
              },
              { text: 'Transcribe this audio precisely. Detect the language automatically. Fix the punctuation and grammar to make it clear, but keep the original meaning. Only output the transcribed text, nothing else.' },
            ],
          },
        ],
        config: {
            temperature: 0.1,
        },
      });

      res.json({ text: response.text || '' });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

export default app;
