import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { chatWithCoach, clearCoachHistory } from "@/lib/ai-coach.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coach")({
  component: Coach,
});

const QUICK_PROMPTS = [
  "What should I do this week?",
  "Suggest a new milestone",
  "Help me prepare for my next promotion",
  "How do I get more visibility at work?",
];

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; created_at: string };

function Coach() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatFn = useServerFn(chatWithCoach);
  const clearFn = useServerFn(clearCoachHistory);

  const messagesQuery = useQuery({
    queryKey: ["coach", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase
        .from("coach_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const messages = messagesQuery.data ?? [];

  const sendMessage = useMutation({
    mutationFn: async (message: string) => chatFn({ data: { message } }),
    onSuccess: () => {
      setInput("");
      qc.invalidateQueries({ queryKey: ["coach"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearChat = useMutation({
    mutationFn: async () => clearFn(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coach"] }); toast.success("Chat cleared"); },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sendMessage.isPending]);

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sendMessage.isPending) return;
    sendMessage.mutate(msg);
  };

  return (
    <div className="min-h-screen pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full brand-gradient">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Career Coach</h1>
              <p className="text-[11px] text-muted-foreground">Personalized to your roadmap</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => clearChat.mutate()}>
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </header>

      <main ref={scrollRef} className="mx-auto w-full max-w-2xl px-4 py-4 space-y-3">

        {messages.length === 0 && (
          <Card className="p-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full brand-gradient">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Ask me anything about your career</h3>
              <p className="text-sm text-muted-foreground mt-1">I know your roadmap, current role, and goal.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </Card>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "brand-gradient text-white rounded-br-md"
                  : "bg-card border border-border/60 rounded-bl-md",
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-card border border-border/60 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask your coach…"
              maxLength={2000}
              className="min-h-[44px] max-h-[140px] resize-none rounded-2xl"
            />
            <Button
              className="brand-gradient text-white rounded-full h-11 w-11 p-0 shrink-0"
              disabled={!input.trim() || sendMessage.isPending}
              onClick={() => handleSend()}
            >
              {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
