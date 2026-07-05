"use client";

import { ChatProvider } from "@/contexts/chat-context";
import { FloatingChat } from "@/components/assistant/floating-chat";
import { useAuthSession } from "@/hooks/use-auth-session";

export function ChatShell({ children }: { children: React.ReactNode }) {
  const { loading, canUseChat } = useAuthSession();

  return (
    <ChatProvider chatEnabled={!loading && canUseChat}>
      {children}
      {!loading && canUseChat && <FloatingChat />}
    </ChatProvider>
  );
}
