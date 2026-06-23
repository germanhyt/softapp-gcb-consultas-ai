"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { DEFAULT_MODEL_ID, resolveModelId } from "@/lib/ai/models";
import { textFromUIMessageParts } from "@/lib/ai/ui-message-text";
import {
  CHAT_MODE_STORAGE_KEY,
  isChatMode,
  type ChatMode,
} from "@/lib/ai/chat-modes";

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
  chatMode: ChatMode;
  sendMessage: (content: string) => void;
  clearMessages: () => void;
  regenerateLastResponse: () => void;
  setIsOpen: (open: boolean) => void;
  toggleChat: () => void;
  toggleExpanded: () => void;
  setSelectedModel: (model: string) => void;
  setChatMode: (mode: ChatMode) => void;
  stopGenerating: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = "refugio_chat_messages";
const MODEL_KEY = "refugio_chat_model";
const MAX_MESSAGES = 50;

type LegacyStoredMessage = {
  id?: string;
  role: string;
  content: unknown;
};

function loadStoredMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const first = parsed[0] as Record<string, unknown>;
    if ("parts" in first && Array.isArray(first.parts)) {
      return parsed as UIMessage[];
    }

    if ("content" in first) {
      return (parsed as LegacyStoredMessage[]).map((m) => ({
        id: m.id ?? generateId(),
        role: m.role as UIMessage["role"],
        parts: [{ type: "text" as const, text: String(m.content ?? "") }],
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveMessages(messages: UIMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const toSave = /* UIMessage[] */ messages.slice(-MAX_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

function loadModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  return resolveModelId(localStorage.getItem(MODEL_KEY));
}

function loadChatMode(): ChatMode {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(CHAT_MODE_STORAGE_KEY);
  return isChatMode(stored) ? stored : "auto";
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedModel, setSelectedModelState] = useState(DEFAULT_MODEL_ID);
  const [chatMode, setChatModeState] = useState<ChatMode>("auto");
  const [isInitialized, setIsInitialized] = useState(false);

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const chatModeRef = useRef(chatMode);
  chatModeRef.current = chatMode;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({
          messages: msgs,
          body,
          headers,
          credentials,
          api,
        }) => ({
          body: {
            ...(body && typeof body === "object" ? body : {}),
            messages: msgs,
            modelId: selectedModelRef.current,
            chatMode: chatModeRef.current,
          },
          headers,
          credentials,
          api,
        }),
      }),
    [],
  );

  const {
    messages: aiMessages,
    sendMessage: sendChatMessage,
    setMessages: setAiMessages,
    stop,
    regenerate,
    status,
    error,
    clearError,
  } = useChat({
    transport,
    onError: (err) => {
      console.error("[Chat]", err);
    },
    onFinish: () => {
      clearError();
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) {
      setAiMessages(stored);
    }
    setSelectedModelState(loadModel());
    setChatModeState(loadChatMode());
    setIsInitialized(true);
  }, [setAiMessages]);

  useEffect(() => {
    if (isInitialized && aiMessages.length > 0) {
      saveMessages(aiMessages);
    }
  }, [aiMessages, isInitialized]);

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

  const messages: ChatMessage[] = aiMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: textFromUIMessageParts(m.parts),
    timestamp: new Date().toISOString(),
    isStreaming:
      isLoading &&
      m.role === "assistant" &&
      m === aiMessages[aiMessages.length - 1],
    model: selectedModel,
  }));

  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isLoading) return;
      clearError();
      void sendChatMessage({ text: content.trim() });
    },
    [sendChatMessage, isLoading, clearError],
  );

  const clearMessages = useCallback(() => {
    stop();
    setAiMessages([]);
    clearError();
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [stop, setAiMessages, clearError]);

  const regenerateLastResponse = useCallback(() => {
    void regenerate();
  }, [regenerate]);

  const setSelectedModel = useCallback((model: string) => {
    setSelectedModelState(model);
    if (typeof window !== "undefined") {
      localStorage.setItem(MODEL_KEY, model);
    }
  }, []);

  const setChatMode = useCallback((mode: ChatMode) => {
    setChatModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode);
    }
  }, []);

  const stopGenerating = useCallback(() => {
    stop();
  }, [stop]);

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
        error: error?.message ?? null,
        isOpen,
        isExpanded,
        selectedModel,
        chatMode,
        sendMessage,
        clearMessages,
        regenerateLastResponse,
        setIsOpen,
        toggleChat,
        toggleExpanded,
        setSelectedModel,
        setChatMode,
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
