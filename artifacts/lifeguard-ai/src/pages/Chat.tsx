import { useState } from 'react';
import { useListChatMessages, useListChatSessions, useCreateChatSession, useSendChatMessage } from '@workspace/api-client-react';
import { MessageCircle, Send, Plus, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Chat() {
  const { data: sessions, isLoading: sessionsLoading } = useListChatSessions();
  const activeSessionId = sessions?.[0]?.id; // Default to most recent

  const { data: messages, isLoading: messagesLoading } = useListChatMessages(activeSessionId!, {
    query: { enabled: !!activeSessionId }
  });

  const createSession = useCreateChatSession();
  const sendMessage = useSendChatMessage();

  const [input, setInput] = useState('');

  const quickPrompts = [
    { label: "First Aid", icon: Activity, text: "I need first aid help right now." },
    { label: "Fall Assist", icon: AlertTriangle, text: "I had a fall, what should I check?" },
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    const send = (sessionId: number) => {
      // Optimistic update could go here
      sendMessage.mutate({ id: sessionId, data: { content: text } }, {
        onSuccess: () => setInput(''),
        onError: () => toast.error("Failed to send message")
      });
    };

    if (!activeSessionId) {
      createSession.mutate({ data: { title: "Emergency Session" } }, {
        onSuccess: (newSession) => {
          send(newSession.id);
        }
      });
    } else {
      send(activeSessionId);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur z-10 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="text-primary w-5 h-5" />
          <h1 className="text-lg font-bold font-mono tracking-widest">AI MED-ASSIST</h1>
        </div>
        <button 
          onClick={() => createSession.mutate({ data: { title: "New Consult" } })}
          className="p-2 bg-secondary rounded-full text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="flex justify-center p-8"><span className="text-muted-foreground animate-pulse font-mono text-sm">Connecting...</span></div>
        ) : messages?.length === 0 || !activeSessionId ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Activity className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-mono text-sm max-w-xs">
              AI First-Responder ready. Provide situation details for immediate guidance.
            </p>
          </div>
        ) : (
          messages?.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground ml-auto rounded-tr-sm" 
                  : "bg-secondary text-secondary-foreground mr-auto rounded-tl-sm font-mono leading-relaxed"
              )}
            >
              {msg.content}
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-background border-t border-border">
        {/* Quick Prompts */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt.text)}
              className="flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-secondary border border-border text-xs font-mono flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <prompt.icon className="w-3 h-3" />
              {prompt.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Describe situation..."
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ring-primary/50 text-foreground placeholder:text-muted-foreground font-mono"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={sendMessage.isPending}
            className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground active:scale-95 transition-transform"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}