import { useState, useRef, useEffect, useCallback } from 'react';
import { useListOpenaiConversations, useCreateOpenaiConversation, useListOpenaiMessages } from '@workspace/api-client-react';
import { useVoiceRecorder, useVoiceStream } from '@workspace/integrations-openai-ai-react/audio';
import { MessageCircle, Send, Plus, Activity, AlertTriangle, Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
const WORKLET_PATH = `${BASE}/audio-playback-worklet.js`;

export default function Chat() {
  const { data: conversations, refetch: refetchConvs } = useListOpenaiConversations();
  const activeConvId = conversations?.[0]?.id;

  // activeConvId ?? 0: hook always runs; returns [] for id=0 (no conversation yet)
  const { data: serverMessages, refetch: refetchMessages } = useListOpenaiMessages(activeConvId ?? 0);

  const createConv = useCreateOpenaiConversation();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<StreamingMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice hooks
  const recorder = useVoiceRecorder();
  const voiceStream = useVoiceStream({
    workletPath: WORKLET_PATH,
    onTranscript: (chunk, full) => setVoiceTranscript(full),
    onUserTranscript: (text) => {
      setStreaming(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    },
    onComplete: (transcript) => {
      setVoiceTranscript('');
      refetchMessages();
      setStreaming([]);
    },
    onError: (err) => {
      toast.error('Voice AI error: ' + err.message);
      setVoiceTranscript('');
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serverMessages, streaming, voiceTranscript]);

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (activeConvId) return activeConvId;
    const conv = await createConv.mutateAsync({ data: { title: 'LifeGuard Session' } });
    await refetchConvs();
    return conv.id;
  }, [activeConvId, createConv, refetchConvs]);

  // ── Text send (SSE streaming) ─────────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isSending) return;
    setInput('');
    setIsSending(true);

    const userMsg: StreamingMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantMsg: StreamingMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '', isStreaming: true };
    setStreaming([userMsg, assistantMsg]);

    try {
      const convId = await ensureConversation();
      const res = await fetch(`${BASE}/api/openai/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = JSON.parse(line.slice(5).trim());
          if (payload.done) break;
          if (payload.error) throw new Error(payload.error);
          if (payload.content) {
            setStreaming(prev => prev.map(m =>
              m.isStreaming ? { ...m, content: m.content + payload.content } : m
            ));
          }
        }
      }
    } catch (err: unknown) {
      toast.error('AI unavailable: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setStreaming([]);
    } finally {
      setIsSending(false);
      setStreaming(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
      refetchMessages();
      setTimeout(() => setStreaming([]), 300);
    }
  }, [isSending, ensureConversation, refetchMessages]);

  // ── Voice push-to-talk ────────────────────────────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (recorder.state === 'recording') {
      const blob = await recorder.stopRecording();
      if (blob.size < 100) return; // empty
      const convId = await ensureConversation();
      const url = `${BASE}/api/openai/conversations/${convId}/voice-messages`;
      voiceStream.streamVoiceResponse(url, blob).catch(err => {
        toast.error('Voice error: ' + err.message);
      });
    } else {
      try {
        await recorder.startRecording();
      } catch {
        toast.error('Microphone access denied');
      }
    }
  }, [recorder, ensureConversation, voiceStream]);

  const isRecording = recorder.state === 'recording';
  const isVoicePlaying = voiceStream.playbackState === 'playing';

  const quickPrompts = [
    { label: '🩹 First Aid', text: 'I need first aid guidance right now.' },
    { label: '🫁 CPR', text: 'Walk me through CPR step by step.' },
    { label: '🤕 Fall Check', text: 'I just had a fall. What should I check for?' },
    { label: '❤️ Heart Attack', text: 'What are heart attack symptoms and what do I do?' },
  ];

  // Merge server messages with streaming overlay
  const displayMessages: StreamingMessage[] = [
    ...(serverMessages?.map(m => ({ id: String(m.id), role: m.role as 'user' | 'assistant', content: m.content })) ?? []),
    ...streaming,
  ];

  const isEmpty = displayMessages.length === 0 && !voiceTranscript;

  return (
    <div className="flex flex-col h-full relative bg-background">
      {/* Header */}
      <header className="px-5 py-4 border-b border-border bg-card/60 backdrop-blur z-10 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MessageCircle className="text-primary w-5 h-5" />
          <h1 className="text-base font-bold font-mono tracking-widest">AI MED-ASSIST</h1>
          {(isSending || isVoicePlaying) && (
            <span className="flex items-center gap-1 text-xs text-primary font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {isVoicePlaying ? 'Speaking...' : 'Thinking...'}
            </span>
          )}
        </div>
        <button
          onClick={async () => {
            await createConv.mutateAsync({ data: { title: 'New Consult' } });
            refetchConvs();
          }}
          className="p-2 bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
          title="New conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
            <div className="relative">
              <Activity className="w-16 h-16 text-muted-foreground/20" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-pulse" />
            </div>
            <div>
              <p className="text-foreground font-bold text-sm mb-1">AI First-Responder Ready</p>
              <p className="text-muted-foreground font-mono text-xs max-w-xs">
                Type a situation or tap the mic for voice assistance. I can guide you through any emergency.
              </p>
            </div>
          </div>
        ) : (
          displayMessages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-secondary text-secondary-foreground rounded-tl-sm font-mono'
              )}>
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-primary/60 ml-1 animate-pulse rounded-sm align-middle" />
                )}
              </div>
            </div>
          ))
        )}

        {/* Voice transcript overlay */}
        {voiceTranscript && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-secondary/60 text-secondary-foreground font-mono border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Volume2 className="w-3 h-3 text-primary animate-pulse" />
                <span className="text-xs text-primary font-bold">AI Speaking</span>
              </div>
              {voiceTranscript}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 bg-background border-t border-border">
        {/* Quick prompts */}
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p.text)}
              disabled={isSending}
              className="flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-secondary border border-border text-xs font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Text + mic input row */}
        <div className="flex items-center gap-2">
          {/* Mic button */}
          <button
            onClick={handleMicPress}
            disabled={isSending}
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0',
              isRecording
                ? 'bg-destructive text-white shadow-lg shadow-destructive/30 scale-105'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
            title={isRecording ? 'Tap to send voice' : 'Hold to record'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
            placeholder={isRecording ? 'Recording... tap mic to send' : 'Describe situation...'}
            disabled={isRecording || isSending}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ring-primary/50 text-foreground placeholder:text-muted-foreground font-mono disabled:opacity-60"
          />

          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isSending || isRecording}
            className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 flex-shrink-0"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
          </button>
        </div>

        {isRecording && (
          <p className="text-center text-xs text-destructive font-mono mt-2 animate-pulse">
            🔴 Recording — tap mic button again to send to AI
          </p>
        )}
      </div>
    </div>
  );
}
