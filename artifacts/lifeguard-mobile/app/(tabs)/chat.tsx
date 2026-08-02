import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useColors } from '@/hooks/useColors';
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiMessagesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';

const WEB_TOP_INSET = 67;

const QUICK_PROMPTS = [
  { label: 'First Aid', message: 'What should I do if someone is injured and needs first aid?' },
  { label: 'CPR', message: 'Walk me through CPR steps for an unresponsive adult.' },
  { label: 'Fall', message: 'Someone has fallen and may be injured. What should I do?' },
  { label: 'Heart Attack', message: 'I think someone is having a heart attack. What are the signs and what do I do?' },
];

interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);

  const { data: conversations, isLoading: convsLoading } = useListOpenaiConversations();
  const createConv = useCreateOpenaiConversation();
  const { data: apiMessages, isLoading: msgsLoading } = useListOpenaiMessages(
    activeConvId ?? 0,
    { query: { queryKey: getListOpenaiMessagesQueryKey(activeConvId ?? 0), enabled: activeConvId !== null } },
  );

  // Auto-select or create a conversation on mount
  useEffect(() => {
    if (convsLoading) return;
    if (conversations && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    } else {
      createConv.mutate(
        { data: { title: 'LifeGuard AI Session' } },
        { onSuccess: (conv) => setActiveConvId(conv.id) },
      );
    }
  }, [conversations, convsLoading]);

  // Sync API messages into streaming messages when loaded
  useEffect(() => {
    if (!apiMessages) return;
    setStreamingMessages(
      apiMessages.map((m) => ({
        id: String(m.id),
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    );
  }, [apiMessages]);

  // Combine displayed messages: streamingMessages takes precedence
  const displayMessages = streamingMessages;

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending || activeConvId === null) return;
      const messageText = text.trim();
      setInput('');
      setIsSending(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userMsgId = `user-${Date.now()}`;
      const asstMsgId = `asst-${Date.now()}`;

      setStreamingMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content: messageText },
        { id: asstMsgId, role: 'assistant', content: '', streaming: true },
      ]);

      try {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const url = `https://${domain}/api/openai/conversations/${activeConvId}/messages`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ content: messageText }),
        });

        if (!response.body) throw new Error('No response body');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value as Uint8Array, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const payload = JSON.parse(raw);
              if (payload.content) {
                accumulated += payload.content;
                const snap = accumulated;
                setStreamingMessages((prev) =>
                  prev.map((m) => (m.id === asstMsgId ? { ...m, content: snap } : m)),
                );
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        // Mark as done streaming
        setStreamingMessages((prev) =>
          prev.map((m) => (m.id === asstMsgId ? { ...m, streaming: false } : m)),
        );
        // Refresh messages from server
        queryClient.invalidateQueries({
          queryKey: getListOpenaiMessagesQueryKey(activeConvId),
        });
      } catch {
        setStreamingMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId
              ? { ...m, content: 'Unable to reach AI. Please check your connection.', streaming: false }
              : m,
          ),
        );
      } finally {
        setIsSending(false);
        inputRef.current?.focus();
      }
    },
    [isSending, activeConvId, queryClient],
  );

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleQuickPrompt = useCallback(
    (message: string) => {
      sendMessage(message);
    },
    [sendMessage],
  );

  const topPad = isWeb ? WEB_TOP_INSET : insets.top + 16;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const styles = makeStyles(colors);

  const isLoading = convsLoading || (msgsLoading && activeConvId !== null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
          <View style={[styles.aiDot, { backgroundColor: colors.primary }]} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>AI Med-Assist</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Emergency guidance • Always available
            </Text>
          </View>
        </View>

        {/* Messages */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={[...displayMessages].reverse()}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              isSending &&
              displayMessages[displayMessages.length - 1]?.streaming === true &&
              displayMessages[displayMessages.length - 1]?.content === '' ? (
                <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                </View>
              ) : null
            }
            ListFooterComponent={
              displayMessages.length === 0 ? (
                <View style={styles.emptyChat}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}22` }]}>
                    <Ionicons name="medkit-outline" size={32} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    LifeGuard AI
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                    Emergency medical guidance on demand.{'\n'}Ask anything about first aid or safety.
                  </Text>
                  <View style={styles.quickPromptsGrid}>
                    {QUICK_PROMPTS.map((qp) => (
                      <Pressable
                        key={qp.label}
                        onPress={() => handleQuickPrompt(qp.message)}
                        style={({ pressed }) => [
                          styles.quickPromptBtn,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.quickPromptText, { color: colors.foreground }]}>
                          {qp.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === 'user'
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
              >
                {item.streaming && item.content === '' ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: item.role === 'user' ? '#ffffff' : colors.foreground },
                    ]}
                  >
                    {item.content}
                    {item.streaming ? '▊' : ''}
                  </Text>
                )}
              </View>
            )}
          />
        )}

        {/* Quick prompts (when there are messages) */}
        {displayMessages.length > 0 && !isSending && (
          <View style={[styles.quickPromptsRow, { borderTopColor: colors.border }]}>
            {QUICK_PROMPTS.map((qp) => (
              <Pressable
                key={qp.label}
                onPress={() => handleQuickPrompt(qp.message)}
                style={({ pressed }) => [
                  styles.quickChip,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.quickChipText, { color: colors.foreground }]}>{qp.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Input */}
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: bottomPad + 8, borderTopColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about first aid, CPR, emergencies…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, { color: colors.foreground }]}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim() || isSending}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor:
                    input.trim() && !isSending ? colors.primary : colors.secondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
    },
    aiDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    headerSub: {
      fontSize: 12,
      marginTop: 1,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageList: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexGrow: 1,
    },
    emptyChat: {
      alignItems: 'center',
      paddingTop: 40,
      paddingHorizontal: 20,
      gap: 12,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
    },
    emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    quickPromptsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      marginTop: 8,
    },
    quickPromptBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
    },
    quickPromptText: {
      fontSize: 14,
      fontWeight: '500',
    },
    bubble: {
      maxWidth: '80%',
      marginVertical: 4,
      padding: 12,
      borderRadius: 16,
    },
    userBubble: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    aiBubble: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
    },
    bubbleText: {
      fontSize: 15,
      lineHeight: 21,
    },
    quickPromptsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
      borderTopWidth: 1,
    },
    quickChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    quickChipText: {
      fontSize: 12,
      fontWeight: '500',
    },
    inputContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: 1,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 8,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      maxHeight: 100,
      lineHeight: 20,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
  });
}
