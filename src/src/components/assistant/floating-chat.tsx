"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useGlobalChat, type ChatMessage } from "@/contexts/chat-context";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Trash2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  CreditCard,
  ShoppingCart,
  Car,
  Users,
  ChevronDown,
  X,
  MessageCircle,
  Maximize2,
  Minimize2,
  User,
  Square,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageContent } from "./message-content";
import { FavoritesPanel } from "./favorites-panel";
import { SaveFavoriteDialog } from "./save-favorite-dialog";
import { isFavoriteQuery } from "@/lib/favorites";

// Suggested questions per module
const SUGGESTIONS = [
  {
    icon: CreditCard,
    text: "¿Cuál es la cobertura de conciliación de esta semana?",
    description: "Cuadre de tarjetas",
  },
  {
    icon: CreditCard,
    text: "¿Cuántos vouchers huérfanos hay pendientes?",
    description: "Vouchers sin match",
  },
  {
    icon: ShoppingCart,
    text: "¿Cuáles fueron las ventas de ayer?",
    description: "Análisis de ventas",
  },
  {
    icon: CreditCard,
    text: "¿Qué algoritmo tiene mejor rendimiento?",
    description: "Rendimiento algoritmos",
  },
];

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-5 bg-emerald-500 rounded-sm animate-pulse ml-1 align-middle" />
  );
}

function ThinkingAnimation() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1">
        <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" />
        <span className="text-sm text-slate-500 dark:text-slate-300 font-medium">
          Analizando tu consulta
        </span>
      </div>
      <div className="flex gap-1">
        <span
          className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}


// Compact chat message
function CompactChatMessage({
  message,
  onSaveFavorite,
}: {
  message: ChatMessage;
  onSaveFavorite?: (query: string) => void;
}) {
  const isUser = message.role === "user";
  const isFaved = isUser && message.content && isFavoriteQuery(message.content);

  return (
    <div
      className={cn(
        "flex gap-3 px-3 sm:px-4 py-3 group/msg",
        isUser
          ? "bg-slate-100 dark:bg-slate-700"
          : "bg-white dark:bg-zinc-800"
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full shadow-sm",
          isUser
            ? "bg-slate-600 dark:bg-slate-500 text-white"
            : "bg-emerald-600 text-white"
        )}
      >
        {isUser ? (
          <span className="text-xs font-semibold">Tú</span>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-hidden min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {isUser ? "Tú" : "Asistente"}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {formatTime(message.timestamp)}
          </span>
          {isUser && onSaveFavorite && !isFaved && (
            <button
              onClick={() => onSaveFavorite(message.content)}
              className="opacity-0 group-hover/msg:opacity-100 transition-opacity"
              title="Guardar como favorito"
            >
              <Star className="h-3 w-3 text-slate-400 hover:text-yellow-500" />
            </button>
          )}
          {isFaved && (
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          )}
          {message.isStreaming && message.content && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Escribiendo...
            </span>
          )}
        </div>

        <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
          {message.isStreaming && !message.content ? (
            <ThinkingAnimation />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MessageContent
                content={message.content}
                isExpanded={false}
                isStreaming={message.isStreaming}
              />
              {message.isStreaming && message.content && <StreamingCursor />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Expanded chat message (with tables/charts)
function ExpandedChatMessage({
  message,
  onSaveFavorite,
}: {
  message: ChatMessage;
  onSaveFavorite?: (query: string) => void;
}) {
  const isUser = message.role === "user";
  const isFaved = isUser && message.content && isFavoriteQuery(message.content);

  return (
    <div
      className={cn(
        "flex gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5 group/msg",
        isUser
          ? "bg-slate-100 dark:bg-slate-700"
          : "bg-white dark:bg-zinc-800"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full shadow-sm",
          isUser
            ? "bg-slate-600 dark:bg-slate-500 text-white"
            : "bg-emerald-600 text-white"
        )}
      >
        {isUser ? <User className="h-4 w-4 sm:h-5 sm:w-5" /> : <Bot className="h-4 w-4 sm:h-5 sm:w-5" />}
      </div>

      <div className="flex-1 space-y-2 overflow-hidden min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
            {isUser ? "Tú" : "Asistente El Refugio"}
          </span>
          <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
            {formatTime(message.timestamp)}
          </span>
          {isUser && onSaveFavorite && !isFaved && (
            <button
              onClick={() => onSaveFavorite(message.content)}
              className="opacity-0 group-hover/msg:opacity-100 transition-opacity"
              title="Guardar como favorito"
            >
              <Star className="h-3.5 w-3.5 text-slate-400 hover:text-yellow-500" />
            </button>
          )}
          {isFaved && (
            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          )}
          {message.isStreaming && message.content && (
            <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Escribiendo...
            </span>
          )}
        </div>

        <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
          {message.isStreaming && !message.content ? (
            <ThinkingAnimation />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-li:my-0.5">
              <MessageContent
                content={message.content}
                isExpanded={true}
                isStreaming={message.isStreaming}
              />
              {message.isStreaming && message.content && <StreamingCursor />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Floating chat button
export function FloatingChatButton() {
  const { isOpen, isExpanded, toggleChat, messages } = useGlobalChat();
  const unreadCount = messages.filter((m) => m.role === "assistant").length;

  if (isExpanded && isOpen) return null;

  return (
    <Button
      onClick={toggleChat}
      size="icon"
      className={cn(
        "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg transition-all duration-300",
        isOpen
          ? "bg-gray-500 hover:bg-gray-600"
          : "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
      )}
      title={isOpen ? "Cerrar chat" : "Abrir asistente (Ctrl+K)"}
    >
      {isOpen ? (
        <X className="h-6 w-6" />
      ) : (
        <>
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && messages.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </>
      )}
    </Button>
  );
}

// Floating chat window (compact mode)
export function FloatingChatWindow() {
  const {
    messages,
    isLoading,
    error,
    isOpen,
    isExpanded,
    sendMessage,
    clearMessages,
    regenerateLastResponse,
    setIsOpen,
    toggleExpanded,
    stopGenerating,
  } = useGlobalChat();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [savingFavoriteQuery, setSavingFavoriteQuery] = useState<string | null>(null);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    []
  );

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    }
  }, []);

  useEffect(() => {
    if (!showScrollButton && isOpen && !isExpanded) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, showScrollButton, isOpen, isExpanded]);

  useEffect(() => {
    if (messages.length > 0 && isOpen && !isExpanded) {
      const last = messages[messages.length - 1];
      if (last.role === "user") {
        scrollToBottom("instant");
        setShowScrollButton(false);
      }
    }
  }, [messages.length, scrollToBottom, isOpen, isExpanded]);

  if (!isOpen || isExpanded) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-24 right-2 sm:right-6 z-50 w-[calc(100vw-16px)] sm:w-[400px] h-[70vh] sm:h-[600px] max-h-[80vh] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-emerald-600/20 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white/20 text-white shadow-sm">
            <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-white">
              Asistente El Refugio
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
              </span>
              <ModelSelector />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFavorites(true)}
            className="h-7 w-7 sm:h-8 sm:w-8 text-white/80 hover:text-white hover:bg-white/10"
            title="Favoritos"
          >
            <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleExpanded}
            className="h-7 w-7 sm:h-8 sm:w-8 text-white/80 hover:text-white hover:bg-white/10"
            title="Expandir"
          >
            <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          {isLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={stopGenerating}
              className="h-7 w-7 sm:h-8 sm:w-8 text-red-300 hover:text-red-200 hover:bg-white/10"
              title="Detener"
            >
              <Square className="h-3 w-3" />
            </Button>
          )}
          {messages.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={regenerateLastResponse}
                disabled={isLoading || messages.length < 2}
                className="h-7 w-7 sm:h-8 sm:w-8 text-white/80 hover:text-white hover:bg-white/10"
                title="Regenerar"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                    isLoading && "animate-spin"
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearMessages}
                disabled={isLoading}
                className="h-7 w-7 sm:h-8 sm:w-8 text-white/80 hover:text-red-300 hover:bg-white/10"
                title="Limpiar"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-7 w-7 sm:h-8 sm:w-8 text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* Save favorite dialog */}
      {savingFavoriteQuery && (
        <SaveFavoriteDialog
          query={savingFavoriteQuery}
          onSaved={() => setSavingFavoriteQuery(null)}
          onCancel={() => setSavingFavoriteQuery(null)}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth relative"
      >
        {/* Favorites overlay */}
        {showFavorites && (
          <FavoritesPanel
            onExecute={sendMessage}
            onClose={() => setShowFavorites(false)}
          />
        )}

        <div className="min-h-full flex flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 px-4 py-6 text-center">
              <div className="relative mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 shadow-lg">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-md border border-slate-200 dark:border-zinc-700">
                  <Bot className="h-3 w-3 text-emerald-600" />
                </div>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                Asistente El Refugio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mb-4 leading-relaxed">
                Puedo ayudarte con{" "}
                <strong>conciliación de tarjetas</strong>, ventas,
                estacionamiento y flujo de personas.
              </p>

              <div className="w-full max-w-[320px]">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-medium uppercase tracking-wide">
                  Sugerencias
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTIONS.slice(0, 3).map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <Button
                        key={i}
                        variant="outline"
                        className="h-auto py-2 px-3 justify-start text-left flex items-center gap-2 border-slate-200 dark:border-zinc-700 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-700 transition-colors"
                        onClick={() => sendMessage(s.text)}
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                          {s.text}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500">
                <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded text-[9px] font-mono text-slate-600 dark:text-slate-300">
                  Ctrl+K
                </kbd>{" "}
                para abrir/cerrar
              </p>
            </div>
          ) : (
            <div className="flex-1">
              {messages.map((message) => (
                <CompactChatMessage
                  key={message.id}
                  message={message}
                  onSaveFavorite={setSavingFavoriteQuery}
                />
              ))}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom */}
      {messages.length > 0 && showScrollButton && (
        <div className="absolute bottom-24 sm:bottom-28 right-2 sm:right-4 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 rounded-full shadow-lg"
            onClick={() => {
              scrollToBottom();
              setShowScrollButton(false);
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 px-3 sm:px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-[10px] opacity-80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t">
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          placeholder="Pregunta sobre conciliación, ventas..."
        />
      </div>
    </div>
  );
}

// Expanded chat panel
export function ExpandedChatPanel() {
  const {
    messages,
    isLoading,
    error,
    isOpen,
    isExpanded,
    sendMessage,
    clearMessages,
    regenerateLastResponse,
    setIsOpen,
    toggleExpanded,
    stopGenerating,
  } = useGlobalChat();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [savingFavoriteQuery, setSavingFavoriteQuery] = useState<string | null>(null);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    []
  );

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    }
  }, []);

  useEffect(() => {
    if (!showScrollButton && isOpen && isExpanded) scrollToBottom();
  }, [messages, scrollToBottom, showScrollButton, isOpen, isExpanded]);

  useEffect(() => {
    if (messages.length > 0 && isOpen && isExpanded) {
      const last = messages[messages.length - 1];
      if (last.role === "user") {
        scrollToBottom("instant");
        setShowScrollButton(false);
      }
    }
  }, [messages.length, scrollToBottom, isOpen, isExpanded]);

  const handleClose = () => {
    toggleExpanded();
    setIsOpen(false);
  };

  if (!isOpen || !isExpanded) return null;

  return (
      <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-zinc-900 flex flex-col"
        style={{ opacity: 1 }}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-emerald-600/20 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/20 text-white shadow-md">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Asistente El Refugio
              </h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
                </span>
                <ModelSelector />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFavorites(true)}
              className="h-8 w-8 sm:h-9 sm:w-9 text-white/80 hover:text-white hover:bg-white/10"
              title="Favoritos"
            >
              <Star className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleExpanded}
              className="h-8 w-8 sm:h-9 sm:w-9 text-white/80 hover:text-white hover:bg-white/10"
              title="Modo compacto"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            {isLoading && (
              <Button
                variant="ghost"
                size="icon"
                onClick={stopGenerating}
                className="h-8 w-8 sm:h-9 sm:w-9 text-red-300 hover:text-red-200 hover:bg-white/10"
                title="Detener generación"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            )}
            {messages.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={regenerateLastResponse}
                  disabled={isLoading || messages.length < 2}
                  className="h-8 w-8 sm:h-9 sm:w-9 text-white/80 hover:text-white hover:bg-white/10"
                  title="Regenerar"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      isLoading && "animate-spin"
                    )}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearMessages}
                  disabled={isLoading}
                  className="h-8 w-8 sm:h-9 sm:w-9 text-white/80 hover:text-red-300 hover:bg-white/10"
                  title="Limpiar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 sm:h-9 sm:w-9 text-white/80 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Save favorite dialog */}
        {savingFavoriteQuery && (
          <SaveFavoriteDialog
            query={savingFavoriteQuery}
            onSaved={() => setSavingFavoriteQuery(null)}
            onCancel={() => setSavingFavoriteQuery(null)}
          />
        )}

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth relative"
          style={{ scrollbarGutter: "stable" }}
        >
          {/* Favorites overlay */}
          {showFavorites && (
            <FavoritesPanel
              onExecute={sendMessage}
              onClose={() => setShowFavorites(false)}
            />
          )}

          <div className="min-h-full flex flex-col">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 px-4 sm:px-6 py-6 sm:py-10 text-center">
                <div className="relative mb-4 sm:mb-6">
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-emerald-600 shadow-lg">
                    <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-md border border-slate-200 dark:border-zinc-700">
                    <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  Asistente El Refugio
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 sm:mb-8 leading-relaxed">
                  Consulta sobre{" "}
                  <strong>conciliación de tarjetas</strong>,{" "}
                  <strong>ventas</strong>, <strong>estacionamiento</strong> y{" "}
                  <strong>flujo de personas</strong>.
                </p>

                <div className="w-full max-w-lg px-2">
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-3 sm:mb-4 font-medium uppercase tracking-wide">
                    Prueba preguntando
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {SUGGESTIONS.map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <Button
                          key={i}
                          variant="outline"
                          className="h-auto py-2 sm:py-3 px-3 sm:px-4 justify-start text-left flex items-start gap-2 sm:gap-3 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-700 transition-colors shadow-sm"
                          onClick={() => sendMessage(s.text)}
                        >
                          <div className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                            <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                              {s.text}
                            </p>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                              {s.description}
                            </p>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-6 sm:mt-8 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                  <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded text-xs font-mono text-slate-600 dark:text-slate-300">
                    Ctrl+K
                  </kbd>{" "}
                  para abrir/cerrar
                </p>
              </div>
            ) : (
              <div className="flex-1">
                {messages.map((message) => (
                  <ExpandedChatMessage
                    key={message.id}
                    message={message}
                    onSaveFavorite={setSavingFavoriteQuery}
                  />
                ))}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </div>

        {/* Scroll to bottom */}
        {messages.length > 0 && showScrollButton && (
          <div className="absolute bottom-32 right-6 z-10">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full shadow-lg"
              onClick={() => {
                scrollToBottom();
                setShowScrollButton(false);
              }}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 bg-destructive/10 border-t border-destructive/20">
            <div className="flex items-start gap-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-xs opacity-80 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0">
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            placeholder="Pregunta sobre conciliación, ventas..."
          />
        </div>
      </div>
  );
}

// Combined component for layout
export function FloatingChat() {
  return (
    <>
      <FloatingChatWindow />
      <ExpandedChatPanel />
      <FloatingChatButton />
    </>
  );
}
