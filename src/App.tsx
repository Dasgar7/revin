import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Terminal,
  Code2,
  LayoutTemplate,
  Copy,
  Download,
  ChevronRight,
  Check,
  Paperclip,
  Palette,
  Layout,
  X,
  Loader,
  ArrowUp,
  Mic,
  Phone,
  PhoneOff,
  MicOff,
  MessageSquare,
  Volume2,
  VolumeX,
} from "lucide-react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  useSandpack,
} from "@codesandbox/sandpack-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { vibeCodeStream, transcribeAudio } from "./services/geminiService";

interface Attachment {
  url: string;
  mimeType: string;
  name: string;
}

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  attachments?: Attachment[];
}

function parseContent(text: string) {
  const thinkMatch = /<think>([\s\S]*?)<\/think>/.exec(text);
  const thinkContent = thinkMatch ? thinkMatch[1].trim() : null;
  const isThinking = text.includes("<think>") && !text.includes("</think>");
  const currentThinking = isThinking ? text.split("<think>")[1].trim() : null;

  const codeRegex = /```(.*?)?\n([\s\S]*?)(?:```|$)/g;
  let matches;
  const blocks: { language: string; code: string; filename: string }[] = [];
  while ((matches = codeRegex.exec(text)) !== null) {
    const lang = matches[1]?.trim() || "text";
    const code = matches[2];

    const fileMatch = code.match(/^\/\/\s*(?:file:)?\s*([^\n]+\.[a-z]+)/i);
    const htmlFileMatch = code.match(/^<!--\s*(?:file:)?\s*([^\n]+\.[a-z]+)\s*-->/i);
    const cssFileMatch = code.match(/^\/\*\s*(?:file:)?\s*([^\n]+\.[a-z]+)\s*\*\//i);
    
    let filename = "App.tsx";
    if (fileMatch) {
      filename = fileMatch[1].trim();
    } else if (htmlFileMatch) {
      filename = htmlFileMatch[1].trim();
    } else if (cssFileMatch) {
      filename = cssFileMatch[1].trim();
    } else if (lang === "css" || lang === "style") {
      filename = "index.css";
    } else if (lang === "html") {
      filename = "index.html";
    } else if (lang === "json") {
      filename = "package.json";
    }

    // Always map src/App.tsx to App.tsx since Sandpack react-ts template uses /App.tsx as entry
    filename = filename.replace(/^\/?src\//, "");

    blocks.push({
      language: lang,
      code,
      filename: filename.startsWith("/") ? filename : `/${filename}`,
    });
  }

  const displayContent = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "").trim();

  return {
    thinkContent: thinkContent || currentThinking,
    blocks,
    displayContent: displayContent || (blocks.length > 0 ? "_Code updated in workspace._" : ""),
    isThinking,
  };
}

function ThoughtDisplay({ content, isThinking }: { content: string, isThinking: boolean }) {
  const [displayedText, setDisplayedText] = useState('');
  const textRef = useRef(content);
  
  useEffect(() => {
    textRef.current = content;
  }, [content]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const tick = () => {
      setDisplayedText((prev) => {
        const target = textRef.current;
        if (prev.length < target.length) {
          // Add 1 to 2 chars randomly to make it look like natural typing
          const charsToAdd = Math.floor(Math.random() * 2) + 1;
          return target.slice(0, prev.length + charsToAdd); 
        }
        return prev;
      });
      timer = setTimeout(tick, 30);
    };
    timer = setTimeout(tick, 25);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="mt-2 text-[12px] text-gray-400 pl-3 border-l-2 border-[#2b2d31] whitespace-pre-wrap font-mono leading-relaxed"
    >
      {displayedText}
      {isThinking && (
        <span className="inline-block w-2 h-3 bg-gray-400 ml-1 animate-pulse" />
      )}
    </motion.div>
  );
}

const THEMES = Array.from({length: 5120}, (_, i) => {
  const prefixes = ["Dark", "Light", "Neon", "Pastel", "Cyber", "Retro", "Minimal", "Material", "Glass", "Cosmic", "Lunar", "Solar", "Ocean", "Forest", "Desert", "Urban"];
  const colors = ["Blue", "Red", "Green", "Purple", "Orange", "Yellow", "Pink", "Teal", "Cyan", "Indigo", "Slate", "Zinc", "Rose", "Emerald"];
  
  const primaryMap: Record<string, string> = {
    "Blue": "bg-blue-500", "Red": "bg-red-500", "Green": "bg-green-500", "Purple": "bg-purple-500",
    "Orange": "bg-orange-500", "Yellow": "bg-yellow-500", "Pink": "bg-pink-500", "Teal": "bg-teal-500",
    "Cyan": "bg-cyan-500", "Indigo": "bg-indigo-500", "Slate": "bg-slate-500", "Zinc": "bg-zinc-500",
    "Rose": "bg-rose-500", "Emerald": "bg-emerald-500"
  };

  const secondaryMap: Record<string, string> = {
    "Blue": "bg-blue-300", "Red": "bg-red-300", "Green": "bg-green-300", "Purple": "bg-purple-300",
    "Orange": "bg-orange-300", "Yellow": "bg-yellow-300", "Pink": "bg-pink-300", "Teal": "bg-teal-300",
    "Cyan": "bg-cyan-300", "Indigo": "bg-indigo-300", "Slate": "bg-slate-300", "Zinc": "bg-zinc-300",
    "Rose": "bg-rose-300", "Emerald": "bg-emerald-300"
  };

  const bgMap: Record<string, string> = {
    "Dark": "bg-gray-900", "Light": "bg-gray-100", "Neon": "bg-black", "Pastel": "bg-stone-100",
    "Cyber": "bg-zinc-950", "Retro": "bg-orange-100", "Minimal": "bg-white", "Material": "bg-gray-200",
    "Glass": "bg-slate-200", "Cosmic": "bg-indigo-950", "Lunar": "bg-slate-900", "Solar": "bg-amber-50",
    "Ocean": "bg-cyan-950", "Forest": "bg-emerald-950", "Desert": "bg-orange-50", "Urban": "bg-zinc-800"
  };

  const prefix = prefixes[i % prefixes.length];
  const color = colors[Math.floor(i / prefixes.length) % colors.length];
  return {
    name: `${prefix} ${color} ${Math.floor(i / 20) + 1}`,
    palette: [bgMap[prefix], primaryMap[color], secondaryMap[color]]
  };
});

const TEMPLATES = Array.from({length: 220}, (_, i) => {
  const types = ["Dashboard", "Landing Page", "E-commerce", "Blog", "Portfolio", "Admin Panel", "SaaS", "Mobile App", "Social Media", "CRM", "Kanban", "Chat", "Analytics", "Settings"];
  const styles = ["Modern", "Classic", "Playful", "Corporate", "Brutalist", "Neumorphic", "Glassmorphic", "Minimalist", "Flat", "Material", "Wireframe"];
  const type = types[i % types.length];
  const style = styles[Math.floor(i / types.length) % styles.length];
  return `${style} ${type} ${(i % 5) + 1}`;
});

const AnimatedLogo = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center gap-12"
  >
    <motion.svg
      viewBox="0 0 200 200"
      className="w-48 h-48 drop-shadow-2xl"
      animate={{ rotate: 360 }}
      transition={{ duration: 12, ease: "linear", repeat: Infinity }}
    >
      <polygon points="100,10 176,65 147,155 100,110 53,155 24,65" fill="#059669" />
      <polygon points="100,10 176,65 130,95 80,50" fill="#a7f3d0" />
      <polygon points="176,65 147,155 100,120 130,95" fill="#34d399" />
      <polygon points="147,155 53,155 75,115 100,120" fill="#10b981" />
      <polygon points="53,155 24,65 65,85 75,115" fill="#059669" />
      <polygon points="24,65 100,10 80,50 65,85" fill="#6ee7b7" />
      <circle cx="100" cy="95" r="35" fill="#1c1d22" className="transition-colors" />
    </motion.svg>
  </motion.div>
);

const ThemeModalComponent = ({ isOpen, onClose, onSelectCustom }: { isOpen: boolean; onClose: () => void; onSelectCustom: () => void; }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [visibleCount, setVisibleCount] = useState(60);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVisibleCount(60);
      setIsOffline(!navigator.onLine);
      let t: NodeJS.Timeout;

      const attemptFinish = () => {
        if (navigator.onLine) {
          setIsInitializing(false);
          setIsOffline(false);
        }
      };

      if (navigator.onLine) {
        setIsInitializing(true);
        t = setTimeout(attemptFinish, 1500);
      } else {
        setIsInitializing(true);
      }

      const handleOnline = () => {
        setIsOffline(false);
        t = setTimeout(attemptFinish, 1000);
      };

      const handleOffline = () => {
        clearTimeout(t);
        setIsOffline(true);
        setIsInitializing(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        clearTimeout(t);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isInitializing) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 60, THEMES.length));
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );
    if (targetRef.current) observer.observe(targetRef.current);
    return () => observer.disconnect();
  }, [isOpen, isInitializing]);

  if (!isOpen) return null;

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-[#1c1d22]/80 backdrop-blur-md z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <AnimatedLogo />
          {isOffline && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-emerald-400 font-medium text-sm tracking-wide animate-pulse"
            >
              Connection Issue...
            </motion.p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#1c1d22] z-50 flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 max-w-[1600px] w-full mx-auto">
        <div className="flex items-center gap-6">
          <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Palette size={28} className="text-emerald-400" /> Choose Theme
          </h3>
          <button
            onClick={onSelectCustom}
            className="bg-[#2b2d31] hover:bg-emerald-500/20 text-gray-200 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/50 px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            Custom Theme
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-2 bg-white/5 rounded-full hover:bg-white/10"
        >
          <X size={24} />
        </button>
      </div>
      <div className="p-6 overflow-y-auto w-full">
        <div className="max-w-[1600px] mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-12">
          {THEMES.slice(0, visibleCount).map((theme) => (
            <button
              key={theme.name}
              className="bg-[#2b2d31] hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 text-sm h-16 px-4 rounded-xl border border-transparent transition-all flex items-center justify-start gap-4 overflow-hidden w-full shadow-lg"
            >
              <div className="flex -space-x-1.5 shrink-0">
                {theme.palette.map((colorClass, idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full shadow-sm ring-2 ring-[#2b2d31] ${colorClass}`}
                  />
                ))}
              </div>
              <span className="truncate font-medium">{theme.name}</span>
            </button>
          ))}
        </div>
        {visibleCount < THEMES.length && (
          <div ref={targetRef} className="h-20 flex items-center justify-center text-gray-500">
             <Loader className="animate-spin" size={24} />
          </div>
        )}
      </div>
    </div>
  );
};

function ErrorListener({ onError, onClearError }: { onError: (error: any) => void; onClearError: () => void }) {
  const { sandpack } = useSandpack();
  const { error } = sandpack;
  
  useEffect(() => {
    if (error) {
      onError(error);
    } else {
      onClearError();
    }
  }, [error, onError, onClearError]);

  return null;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      content:
        "Welcome to Revin. I'm your AI vibe coding assistant. What are we building today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const isTranscribingRef = useRef(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = async () => {
    if (isTranscribingRef.current) return;

    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          if (audioBlob.size > 0) {
            isTranscribingRef.current = true;
            setIsLoading(true);
            try {
              const text = await transcribeAudio(audioBlob);
              setInput((prev) => (prev ? prev + " " + text : text));
            } catch (err) {
              console.error("Failed to transcribe audio", err);
              alert("Failed to transcribe audio. Please try again.");
            } finally {
              setIsLoading(false);
              isTranscribingRef.current = false;
            }
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Microphone access error:", err);
        alert("Microphone access was denied. Please allow microphone access in your browser settings.");
      }
    }
  };

  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [expandedThoughts, setExpandedThoughts] = useState<
    Record<string, boolean>
  >({});
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [isCalling, setIsCalling] = useState(false);
  const [callState, setCallState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAIMuted, setIsAIMuted] = useState(false);
  const [showMessagesInCall, setShowMessagesInCall] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isCallingRef = useRef(false);
  const callStateRef = useRef(callState);
  const isMicMutedRef = useRef(isMicMuted);
  const isAIMutedRef = useRef(isAIMuted);

  useEffect(() => { isCallingRef.current = isCalling; }, [isCalling]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);
  useEffect(() => { isAIMutedRef.current = isAIMuted; }, [isAIMuted]);

  const startListening = () => {
    if (isMicMutedRef.current || !isCallingRef.current) return;
    try {
      if (!recognitionRef.current) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          alert("Speech recognition is not supported in this browser. Please use Chrome/Edge.");
          setIsCalling(false);
          return;
        }
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript.trim() && isCallingRef.current) {
            stopListening();
            submitMessage(finalTranscript);
          }
        };

        recognitionRef.current.onend = () => {
          if (isCallingRef.current && callStateRef.current === "listening" && !isMicMutedRef.current) {
            try { recognitionRef.current.start(); } catch(e) {}
          }
        };
      }
      recognitionRef.current.start();
    } catch (err) {}
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
  };

  const startCall = () => {
    setIsCalling(true);
    setCallState("listening");
    setShowMessagesInCall(false);
    startListening();
  };

  const endCall = () => {
    setIsCalling(false);
    setCallState("idle");
    stopListening();
    window.speechSynthesis.cancel();
  };

  const toggleMicOption = () => {
    setIsMicMuted((prev) => {
      const next = !prev;
      if (next) {
        stopListening();
      } else if (isCalling && callState === "listening") {
        try { recognitionRef.current?.start(); } catch(e) {}
      }
      return next;
    });
  };

  const toggleAIMuteOption = () => {
    setIsAIMuted((prev) => {
      const next = !prev;
      if (next) window.speechSynthesis.cancel();
      return next;
    });
  };

  const readAloud = (text: string) => {
    if (!isCallingRef.current || isAIMutedRef.current) {
      if (isCallingRef.current) {
        setCallState("listening");
        startListening();
      }
      return;
    }
    
    setCallState("speaking");
    const synth = window.speechSynthesis;
    synth.cancel();
    
    // strip markdown wrappers
    let displayContent = text
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/```[\s\S]*?```/g, " I have updated the code. ")
        .replace(/#/g, "")
        .replace(/\*/g, "")
        .trim();
        
    if (!displayContent) {
      setCallState("listening");
      startListening();
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(displayContent);
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 0.85; // slightly deeper pitch for a more professional tone
    
    // Attempt to use a better quality English male voice if available
    const voices = synth.getVoices();
    const preferredVoices = [
      "Google UK English Male",
      "Microsoft Mark",
      "Microsoft David",
      "Daniel", // macOS UK Male
      "Alex",   // macOS US Male
    ];
    
    let selectedVoice = null;
    for (const name of preferredVoices) {
      selectedVoice = voices.find(v => v.name.includes(name));
      if (selectedVoice) break;
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("male"));
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith("en"));
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.onend = () => {
      if (isCallingRef.current) {
        setCallState("listening");
        startListening();
      }
    };
    synth.speak(utterance);
  };


  const [debouncedMessages, setDebouncedMessages] = useState<Message[]>([]);

  const [isMobileWorkspaceOpen, setIsMobileWorkspaceOpen] = useState(false);

  const [isAttachMenuOpenHome, setIsAttachMenuOpenHome] = useState(false);
  const [isAttachMenuOpenWorkspace, setIsAttachMenuOpenWorkspace] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [appMode, setAppMode] = useState<"normal" | "custom_theme">("normal");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      processFile(file);
    });
    e.target.value = '';
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === "string") {
        setAttachments(prev => [...prev, { 
          url: event.target!.result as string, 
          mimeType: file.type, 
          name: file.name 
        }]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    Array.from(items).forEach((item) => {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          processFile(file);
        }
      }
    });
  };
  
  const [sandpackLastError, setSandpackLastError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isHome = messages.length <= 1;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sandpackLastError]);

  const toggleThought = (id: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() && attachments.length === 0) return;
    if (isLoading) return;

    if (isCallingRef.current) {
        setCallState("thinking");
    }

    const currentAttachments = [...attachments];
    setAttachments([]);
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (appMode === "custom_theme") {
      setViewMode("preview");
      setIsMobileWorkspaceOpen(true);
    }

    const modelMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: modelMessageId, role: "model", content: "" },
    ]);
    // Auto expand thought for new message
    setExpandedThoughts((prev) => ({ ...prev, [modelMessageId]: true }));

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, text: m.content, attachments: m.attachments }));

      const stream = vibeCodeStream(userMessage.content, history, appMode === "custom_theme", currentAttachments);

      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMessageId ? { ...msg, content: fullResponse } : msg,
          ),
        );
      }
      // Collapse thought when finished
      setExpandedThoughts((prev) => ({ ...prev, [modelMessageId]: false }));

      if (isCallingRef.current) {
        readAloud(fullResponse);
      }
    } catch (error: any) {
      console.error("Error generating response:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMessageId
            ? { ...msg, content: msg.content + `\n\n**An error occurred:** ${error.message}. Please try again.` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  const handleFixError = () => {
    if (sandpackLastError) {
      const errorMsg = sandpackLastError;
      setSandpackLastError(null);
      submitMessage(`Fix this error:\n\`\`\`\n${errorMsg}\n\`\`\`\n\nHint: If the error says "Element type is invalid... but got: undefined", it almost certainly means you imported an icon from \`lucide-react\` that does not exist. (e.g. \`Gear\` does not exist, use \`Settings\`. \`PlusCircle\` does not exist, use \`CirclePlus\`). Double check your icon imports.`);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("To install the mobile app, please open this app in a new tab, or use your browser's 'Add to Home Screen' / 'Install App' option from the URL bar.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDownloadZip = async (files: Record<string, string>) => {
    const zip = new JSZip();
    Object.entries(files).forEach(([name, content]) => {
      // remove leading slash for JSZip
      const path = name.replace(/^\//, "");
      zip.file(path, content);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "revin-app.zip");
  };

  // Debounce the messages to prevent Sandpack Provider from crashing during streaming
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMessages(messages);
    }, 1500); // 1.5s debounce to pause compiling while generating fast
    return () => clearTimeout(timer);
  }, [messages]);

  const sandpackFiles = useMemo(() => {
    const files: Record<string, string> = {};
    debouncedMessages.forEach((m) => {
      if (m.role === "model" && m.id !== "welcome") {
        const parsed = parseContent(m.content);
        parsed.blocks.forEach((block) => {
          files[block.filename] = block.code;
        });
      }
    });
    return files;
  }, [debouncedMessages]);

  const sandpackOptions = useMemo(() => ({
    externalResources: ["https://cdn.tailwindcss.com"]
  }), []);

  const dynamicDependencies = useMemo(() => {
    const deps: Record<string, string> = {
      "lucide-react": "latest",
      "framer-motion": "^11.0.0",
      motion: "^10.16.2",
      recharts: "^2.12.0",
      clsx: "^2.1.0",
      "tailwind-merge": "^2.2.1",
      tailwindcss: "^3.3.3",
      "date-fns": "^3.6.0",
    };
    
    // Scan all files for imports
    Object.values(sandpackFiles).forEach(code => {
      const importRegex = /import\s+(?:.|\n)*?from\s+['"]([^'.\/][^'"]*)['"]/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        let pkgName = match[1];
        if (pkgName.startsWith('@')) {
           const parts = pkgName.split('/');
           if (parts.length >= 2) pkgName = parts[0] + '/' + parts[1];
        } else {
           pkgName = pkgName.split('/')[0];
        }
        if (!deps[pkgName] && pkgName !== 'react' && pkgName !== 'react-dom') {
          deps[pkgName] = "latest";
        }
      }
    });
    return deps;
  }, [sandpackFiles]);

  const sandpackCustomSetup = useMemo(() => ({
    dependencies: dynamicDependencies
  }), [dynamicDependencies]);

  const renderCallUI = () => {
    if (!isCalling) return null;

    return (
      <AnimatePresence>
        {showMessagesInCall ? (
          <div className="absolute top-14 left-0 right-0 p-3 z-30">
            <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-xl p-3 flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-medium text-sm">Active Call</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowMessagesInCall(false)} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors">
                  Return
                </button>
                <button type="button" onClick={endCall} className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                  <PhoneOff size={16}/>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-[#1c1d22] z-50 flex flex-col items-center justify-between py-12 px-6"
          >
            {/* Top controls */}
            <div className="w-full max-w-4xl flex justify-between items-start px-6 pt-6">
               <button 
                type="button" 
                onClick={() => setShowMessagesInCall(true)} 
                className="flex items-center gap-2 text-gray-400 hover:text-white px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
               >
                <MessageSquare size={18}/>
                <span className="text-sm font-medium">Chat</span>
               </button>

               <button 
                type="button" 
                onClick={() => {
                  setIsMobileWorkspaceOpen(true);
                  setShowMessagesInCall(true);
                }} 
                className="md:hidden flex items-center gap-2 text-gray-400 hover:text-white px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
               >
                <span className="text-sm font-medium">Workspace</span>
                <Layout size={18}/>
               </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center w-full">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center relative transition-all duration-500 ${callState === 'speaking' ? 'bg-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] shadow-emerald-500/50' : 'bg-[#2b2d31]'}`}>
                    {callState === 'listening' && <div className="absolute inset-0 rounded-full border-2 border-emerald-500/50 animate-ping" />}
                    {callState === 'thinking' && <Loader className="absolute text-emerald-500 animate-spin" size={40} />}
                    <span className="text-4xl font-bold text-white tracking-widest">R</span>
                </div>
                
                <div className="mt-12 text-center">
                    <h2 className="text-xl font-medium text-gray-200">
                        {callState === 'listening' ? (isMicMuted ? "Microphone off" : "Listening...") :
                          callState === 'thinking' ? "Thinking..." :
                          callState === 'speaking' ? "Revin is speaking" : "Call starting..."}
                    </h2>
                </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-6 mt-12 bg-[#2b2d31] p-4 rounded-3xl border border-white/5">
                <button type="button" onClick={toggleAIMuteOption} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isAIMuted ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 hover:bg-white/10 text-gray-200'}`}>
                    {isAIMuted ? <VolumeX size={24}/> : <Volume2 size={24}/>}
                </button>
                <button type="button" onClick={toggleMicOption} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMicMuted ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 hover:bg-white/10 text-gray-200'}`}>
                    {isMicMuted ? <MicOff size={24}/> : <Mic size={24}/>}
                </button>
                <button type="button" onClick={endCall} className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-400 text-white shadow-lg transition-transform hover:scale-105">
                    <PhoneOff size={24}/>
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderModals = () => (
    <>
      <ThemeModalComponent 
        isOpen={isThemeModalOpen} 
        onClose={() => setIsThemeModalOpen(false)} 
        onSelectCustom={() => {
          setIsThemeModalOpen(false);
          setAppMode("custom_theme");
          setMessages([
            {
              id: "welcome",
              role: "model",
              content: "Welcome to Revin. I'm your AI vibe coding assistant. What are we building today?",
            },
          ]);
        }} 
      />

      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-[#1c1d22] z-50 flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 max-w-[1600px] w-full mx-auto">
            <h3 className="text-2xl font-semibold text-white flex items-center gap-3"><LayoutTemplate size={28} className="text-emerald-400"/> Choose UI Template</h3>
            <button 
              onClick={() => setIsTemplateModalOpen(false)} 
              className="text-gray-400 hover:text-white transition-colors p-2 bg-white/5 rounded-full hover:bg-white/10"
            >
              <X size={24}/>
            </button>
          </div>
          <div className="p-6 overflow-y-auto w-full">
            <div className="max-w-[1600px] mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {TEMPLATES.map(template => (
                <button key={template} className="bg-[#2b2d31] hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 text-sm h-16 px-4 rounded-xl border border-transparent transition-all flex items-center justify-center overflow-hidden w-full shadow-lg">
                  <span className="truncate font-medium">{template}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept="image/*" />
    </>
  );

  // Determine if we show Kimi style home or Workspace
  if (isHome) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1c1d22] text-white font-sans overflow-hidden">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={handleInstallClick}
            className="text-xs font-medium px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors rounded-md text-emerald-400 flex items-center gap-2 shadow-lg"
          >
            <Download size={14} />
            Download App
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-6xl font-bold tracking-widest text-[#e8e9ea]">
            REVIN
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-3xl px-4"
        >
          <div className="bg-[#2b2d31] rounded-2xl p-2 shadow-2xl ring-1 ring-white/5 focus-within:ring-emerald-500/30 transition-all cursor-text relative">
            {appMode === "custom_theme" && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg w-fit ml-2 mt-1 mb-1 relative group">
                <Palette size={14} className="shrink-0" />
                <span>Custom Theme</span>
                <button 
                  type="button" 
                  onClick={() => setAppMode("normal")} 
                  className="ml-1 opacity-60 hover:opacity-100 hover:bg-emerald-500/20 p-1 rounded-full transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-4">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative group rounded-md border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center min-w-[60px] min-h-[60px]">
                      {att.mimeType.startsWith('image/') ? (
                        <img src={att.url} alt={att.name} className="h-16 w-auto object-cover" />
                      ) : (
                        <div className="text-xs p-2 max-w-[100px] truncate text-gray-400">
                          {att.name}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-red-500 rounded-full text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                placeholder={appMode === "custom_theme" ? "Describe your custom theme..." : "Ask Revin to build a new app..."}
                className="w-full bg-transparent text-[15px] resize-none outline-none px-4 py-4 min-h-[120px] placeholder-gray-500 font-sans"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <div className="flex justify-between items-end px-3 pb-3 mt-1 w-full">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAttachMenuOpenHome(!isAttachMenuOpenHome)}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors relative z-10"
                  >
                    <span className="text-gray-400 text-2xl font-light leading-none pb-0.5">+</span>
                  </button>

                  {isAttachMenuOpenHome && (
                    <>
                      <div className="fixed inset-0 z-10 hidden sm:block" onClick={() => setIsAttachMenuOpenHome(false)} />
                      <div className="absolute bottom-12 left-0 w-48 bg-[#2b2d31] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden z-20">
                        <button type="button" onClick={() => { fileInputRef.current?.click(); setIsAttachMenuOpenHome(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2 transition-colors">
                          <Paperclip size={16} /> Upload File
                        </button>
                        <button type="button" onClick={() => { setIsThemeModalOpen(true); setIsAttachMenuOpenHome(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2 transition-colors border-t border-white/5">
                          <Palette size={16} /> Choose Theme
                        </button>
                        <button type="button" onClick={() => { setIsTemplateModalOpen(true); setIsAttachMenuOpenHome(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2 transition-colors border-t border-white/5">
                          <Layout size={16} /> Choose UI
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-[#2b2d31] hover:bg-[#383a40] border border-white/5'}`}
                  >
                    <Mic size={20} className={isRecording ? "text-white" : "text-gray-400"} />
                  </button>
                  {input.trim() ? (
                    <button
                      type="submit"
                      disabled={isLoading || isRecording}
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowUp size={20} className="text-black" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCall}
                      className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-400 transition-colors shrink-0 shadow-lg shadow-emerald-500/20"
                    >
                      <Phone size={18} className="text-white fill-current" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </motion.div>
        {renderModals()}
        {renderCallUI()}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#1c1d22] text-gray-200 overflow-hidden font-sans selection:bg-emerald-500/30">
      {/* Sidebar / Chat Area */}
      <div className={`w-full md:w-[320px] lg:w-[450px] flex-col bg-[#232428] shrink-0 z-20 shadow-xl h-full border-r border-[#2b2d31] relative ${isMobileWorkspaceOpen ? 'hidden md:flex' : 'flex'}`}>
        
        {renderCallUI()}

        {/* Header */}
        <div className="h-14 flex items-center px-4 md:px-6 shrink-0 justify-between shadow-sm">
          <div className="flex items-center gap-2 text-white font-bold tracking-widest text-lg">
            REVIN
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="text-xs font-medium px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors rounded-md text-emerald-400 flex items-center gap-1"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Download App</span>
            </button>
            <button
              onClick={() => setIsMobileWorkspaceOpen(true)}
              className="md:hidden text-xs font-semibold px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors rounded-md"
            >
              Workspace
            </button>
            <button
              onClick={() => setMessages([messages[0]])}
              className="text-xs font-medium px-2.5 py-1.5 bg-white/5 hover:bg-white/10 transition-colors rounded-md text-gray-300"
            >
              New
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {messages
            .filter((m) => m.id !== "welcome")
            .map((message) => {
              const { thinkContent, displayContent, isThinking } = parseContent(
                message.content,
              );
              const isThoughtExpanded = expandedThoughts[message.id];

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={message.id}
                  className={`flex flex-col text-[14px] leading-relaxed ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  {message.role === "user" ? (
                    <div className="max-w-[85%] flex flex-col items-end gap-1.5 group">
                      <div className="bg-[#383a40] text-[#e8e9ea] px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm flex flex-col gap-2 w-full">
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {message.attachments.map((att, idx) => (
                              <div key={idx} className="rounded border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center">
                                {att.mimeType.startsWith('image/') ? (
                                  <img src={att.url} alt={att.name} className="max-h-32 w-auto object-contain" />
                                ) : (
                                  <div className="text-xs p-2 max-w-[150px] truncate">
                                    {att.name}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                      
                      {message.content && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                            setCopiedMessageId(message.id);
                            setTimeout(() => setCopiedMessageId(null), 2000);
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider rounded transition-all ${
                            copiedMessageId === message.id
                              ? "text-emerald-400 opacity-100"
                              : "text-gray-500 hover:text-gray-300 hover:bg-white/5 opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {copiedMessageId === message.id ? (
                            <>
                              <Check size={12} />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              Copy
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-full flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex flex-col items-center justify-center font-bold text-emerald-400 shrink-0">
                        R
                      </div>
                      <div className="flex-1 overflow-hidden min-w-0 pr-4 mt-1">
                        {/* Thought Process */}
                        {(thinkContent || isThinking) && (
                          <div className="mb-4">
                            <button
                              onClick={() => toggleThought(message.id)}
                              className="flex items-center gap-2 text-[11px] font-medium text-gray-400 hover:text-gray-200 group transition-colors uppercase tracking-wider"
                            >
                              {isThinking ? (
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full border-[1.5px] border-emerald-500 border-t-transparent animate-spin" />
                                  Thinking...
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 bg-[#2b2d31] px-2 py-1 rounded-[4px] border border-white/5 group-hover:border-white/10 shadow-sm">
                                  <ChevronRight
                                    size={12}
                                    className={`transition-transform ${isThoughtExpanded ? "rotate-90" : ""}`}
                                  />
                                  Thought Process
                                </span>
                              )}
                            </button>

                          {(isThoughtExpanded || isThinking) &&
                              thinkContent && (
                                <ThoughtDisplay content={thinkContent} isThinking={isThinking} />
                              )}
                          </div>
                        )}

                        {/* Actual Content Render */}
                        {displayContent && (
                          <div className="markdown-body text-[13px]">
                            <Markdown
                              components={{
                                code({ className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  const isInline = !match && !className;
                                  if (!isInline && match) {
                                    return (
                                      <div className="bg-[#2b2d31] border border-white/5 rounded-xl p-3 my-4 flex flex-col cursor-default shadow-lg hover:border-emerald-500/20 transition-colors">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded shrink-0 bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                            <Code2 size={16} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs text-white font-medium truncate">
                                              Code mapped
                                            </div>
                                            <div className="text-[10px] text-gray-500 uppercase mt-0.5">
                                              {match?.[1] || "text"} file
                                            </div>
                                          </div>
                                          <div className="px-2 py-1 bg-black/40 border border-white/5 rounded text-[10px] text-emerald-400 font-mono tracking-wide">
                                            WORKSPACE
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                pre({ children }) {
                                  return <div className="my-2">{children}</div>;
                                },
                              }}
                            >
                              {displayContent}
                            </Markdown>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          
          {sandpackLastError && (
            <div className="flex w-full mb-6">
              <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center shrink-0 mt-1 border border-red-500/30">
                <X size={16} />
              </div>
              <div className="ml-4 bg-red-400/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-sm">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <span>Sandpack Compilation Error</span>
                </div>
                <div className="font-mono text-xs whitespace-pre-wrap mb-3 max-h-32 overflow-y-auto w-full p-2 bg-black/40 rounded-lg border border-red-500/10">
                  {sandpackLastError}
                </div>
                <button 
                  onClick={handleFixError}
                  className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-xs"
                >
                  <Code2 size={14} />
                  Fix with AI
                </button>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#232428] shrink-0 border-t border-[#2b2d31]">
          <form
            onSubmit={handleSubmit}
            className="relative flex flex-col bg-[#2b2d31] rounded-xl border border-white/5 focus-within:border-emerald-500/30 transition-all shadow-md"
          >
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative group rounded-md border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center min-w-[50px] min-h-[50px]">
                    {att.mimeType.startsWith('image/') ? (
                      <img src={att.url} alt={att.name} className="h-12 w-auto object-cover" />
                    ) : (
                      <div className="text-[10px] p-2 max-w-[80px] truncate text-gray-400">
                        {att.name}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 bg-red-500 rounded-full text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="Ask Revin to adjust..."
              className="w-full bg-transparent px-4 py-3 text-[14px] outline-none resize-none min-h-[50px] max-h-[200px]"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
              <div className="flex justify-between items-end px-2 pb-2 mt-0.5 w-full">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAttachMenuOpenWorkspace(!isAttachMenuOpenWorkspace)}
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors relative z-10"
                >
                  <span className="text-gray-400 text-xl font-light leading-none pb-0.5">+</span>
                </button>

                {isAttachMenuOpenWorkspace && (
                  <>
                    <div className="fixed inset-0 z-10 hidden sm:block" onClick={() => setIsAttachMenuOpenWorkspace(false)} />
                    <div className="absolute bottom-12 left-0 w-48 bg-[#2b2d31] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden z-20">
                      <button type="button" onClick={() => { fileInputRef.current?.click(); setIsAttachMenuOpenWorkspace(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2 transition-colors">
                        <Paperclip size={16} /> Upload File
                      </button>
                      <button type="button" onClick={() => { setIsThemeModalOpen(true); setIsAttachMenuOpenWorkspace(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2 transition-colors border-t border-white/5">
                        <Palette size={16} /> Choose Theme
                      </button>
                      <button type="button" onClick={() => { setIsTemplateModalOpen(true); setIsAttachMenuOpenWorkspace(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2 transition-colors border-t border-white/5">
                        <Layout size={16} /> Choose UI
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-[#2b2d31] hover:bg-[#383a40] border border-white/5'}`}
                >
                  <Mic size={18} className={isRecording ? "text-white" : "text-gray-400"} />
                </button>
                {input.trim() ? (
                  <button
                    type="submit"
                    disabled={isLoading || isRecording}
                    className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={18} className="text-black" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCall}
                    className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-400 transition-colors shrink-0 shadow-lg shadow-emerald-500/20"
                  >
                    <Phone size={16} className="text-white fill-current" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Main Workspace Area (Right) */}
      <div className={`flex-1 flex-col bg-[#1c1d22] relative overflow-hidden h-full ${!isMobileWorkspaceOpen ? 'hidden md:flex' : 'flex'}`}>
        {/* Top Navbar */}
        <div className="h-14 border-b border-[#2b2d31] flex items-center px-2 md:px-4 justify-between bg-[#1c1d22] z-10 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileWorkspaceOpen(false)}
              className="md:hidden text-gray-400 hover:text-white p-2 flex items-center gap-1"
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div className="flex items-center gap-1 bg-[#232428] p-1 rounded-lg border border-white/5 shadow-inner">
              <button
                onClick={() => setViewMode("code")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] md:text-[11px] uppercase tracking-wider font-semibold transition-colors ${viewMode === "code" ? "bg-[#383a40] text-emerald-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
              >
                <Code2 size={14} />
                <span className="hidden sm:inline">Code</span>
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] md:text-[11px] uppercase tracking-wider font-semibold transition-colors ${viewMode === "preview" ? "bg-[#383a40] text-emerald-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
              >
                <LayoutTemplate size={14} />
                <span className="hidden sm:inline">Preview</span>
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {Object.keys(sandpackFiles).length > 0 && (
              <>
                <button
                  onClick={() => {
                    const firstFile = Object.values(sandpackFiles)[0];
                    if (firstFile) navigator.clipboard.writeText(firstFile);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-gray-300 hover:bg-[#2b2d31] transition-colors text-[11px] uppercase tracking-wider font-semibold border border-white/5"
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => handleDownloadZip(sandpackFiles)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-400 transition-colors text-[11px] uppercase tracking-wider font-semibold"
                >
                  <Download size={12} />
                  <span>Download Zip</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Workspace Content */}
        <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full p-2 md:p-4">
          {Object.keys(sandpackFiles).length > 0 ? (
            <div className="w-full h-full bg-[#151515] rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
              <SandpackProvider
                template="react-ts"
                theme="dark"
                files={sandpackFiles}
                options={sandpackOptions}
                customSetup={sandpackCustomSetup}
              >
                <ErrorListener 
                  onError={(err) => setSandpackLastError(err?.message || String(err))} 
                  onClearError={() => setSandpackLastError(null)} 
                />
                <SandpackLayout
                  style={{
                    height: "100%",
                    background: "transparent",
                    border: "none",
                  }}
                >
                  <div style={{ position: "relative", width: "100%", height: "100%" }}>
                    <div 
                      style={{ 
                        position: "absolute", 
                        inset: 0, 
                        opacity: viewMode === "code" ? 1 : 0, 
                        pointerEvents: viewMode === "code" ? "auto" : "none",
                        zIndex: viewMode === "code" ? 10 : 0
                      }}
                    >
                      <SandpackCodeEditor
                        showLineNumbers
                        showTabs
                        style={{ height: "100%", width: "100%" }}
                      />
                    </div>
                    <div 
                      style={{ 
                        position: "absolute", 
                        inset: 0, 
                        display: "flex",
                        flexDirection: "column",
                        opacity: viewMode === "preview" ? 1 : 0, 
                        pointerEvents: viewMode === "preview" ? "auto" : "none",
                        zIndex: viewMode === "preview" ? 10 : 0
                      }}
                    >
                      <SandpackPreview
                        showNavigator
                        showRefreshButton
                        style={{ height: "70%", width: "100%" }}
                      />
                      <SandpackConsole style={{ height: "30%", width: "100%" }} />
                    </div>
                  </div>
                </SandpackLayout>
                <style dangerouslySetInnerHTML={{__html: `
                  .sp-wrapper, .sp-layout, .sp-stack {
                    height: 100% !important;
                    min-height: 100% !important;
                    flex: 1;
                  }
                  .sp-preview, .sp-preview-container, .sp-code-editor {
                    height: 100% !important;
                    min-height: 100% !important;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                  }
                  .sp-preview iframe {
                    height: 100% !important;
                    flex: 1;
                  }
                  .cm-theme {
                    height: 100% !important;
                  }
                `}} />
              </SandpackProvider>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                <Terminal size={32} className="text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white font-mono tracking-widest">
                  WORKSPACE
                </h3>
                <p className="text-sm text-gray-400 max-w-sm mt-2">
                  The AI's coded output will appear here perfectly formatted for
                  editing and previewing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {renderModals()}
    </div>
  );
}
