"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useChat, type Message } from "ai/react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  module?: string;
  model?: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  isExpanded: boolean;
  selectedModel: string;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
  regenerateLastResponse: () => void;
  setIsOpen: (open: boolean) => void;
  toggleChat: () => void;
  toggleExpanded: () => void;
  setSelectedModel: (model: string) => void;
  stopGenerating: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = "refugio_chat_messages";
const MODEL_KEY = "refugio_chat_model";
const MAX_MESSAGES = 50;

function loadStoredMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Message[];
    }
  } catch {
    // ignore
  }
  return [];
}

function saveMessages(messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    const toSave = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

function loadModel(): string {
  if (typeof window === "undefined") return "gemini-2.0-flash";
  return localStorage.getItem(MODEL_KEY) || "gemini-2.0-flash";
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedModel, setSelectedModelState] = useState("gemini-2.0-flash");
  const [isInitialized, setIsInitialized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Vercel AI SDK useChat hook
  const {
    messages: aiMessages,
    isLoading,
    append,
    setMessages: setAiMessages,
    stop,
    reload,
  } = useChat({
    api: "/api/ai/chat",
    body: { modelId: selectedModel },
    onError: (err) => {
      setErrorMsg(err.message || "Error al procesar la consulta");
    },
    onFinish: () => {
      setErrorMsg(null);
    },
  });

  // Load stored messages and model on mount
  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) {
      setAiMessages(stored);
    }
    setSelectedModelState(loadModel());
    setIsInitialized(true);
  }, [setAiMessages]);

  // Save messages when they change
  useEffect(() => {
    if (isInitialized && aiMessages.length > 0) {
      saveMessages(aiMessages);
    }
  }, [aiMessages, isInitialized]);

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Convert AI SDK messages to our ChatMessage format
  const messages: ChatMessage[] = aiMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: new Date().toISOString(),
    isStreaming: isLoading && m.role === "assistant" && m === aiMessages[aiMessages.length - 1],
    model: selectedModel,
  }));

  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isLoading) return;
      setErrorMsg(null);
      append({ role: "user", content: content.trim() });
    },
    [append, isLoading]
  );

  const clearMessages = useCallback(() => {
    stop();
    setAiMessages([]);
    setErrorMsg(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [stop, setAiMessages]);

  const regenerateLastResponse = useCallback(() => {
    reload();
  }, [reload]);

  const setSelectedModel = useCallback((model: string) => {
    setSelectedModelState(model);
    if (typeof window !== "undefined") {
      localStorage.setItem(MODEL_KEY, model);
    }
  }, []);

  const stopGenerating = useCallback(() => {
    stop();
  }, [stop]);

  // Ensure stale abort controller is cleaned up
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        error: errorMsg,
        isOpen,
        isExpanded,
        selectedModel,
        sendMessage,
        clearMessages,
        regenerateLastResponse,
        setIsOpen,
        toggleChat,
        toggleExpanded,
        setSelectedModel,
        stopGenerating,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useGlobalChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useGlobalChat must be used within a ChatProvider");
  }
  return context;
}
