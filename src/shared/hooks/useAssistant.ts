import { supabase } from '@/src/services/supabase';
import { useCallback, useRef, useState } from 'react';

export type AssistantMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
};

type HistoryTurn = {
    original_text: string;
    translated_text: string;
};

type HistorySession = {
    date: string;
    mode: string;
    lang_pair: string;
    turns: HistoryTurn[];
};

const MAX_HISTORY_SESSIONS = 20; // Limit to avoid token overflows

export const useAssistant = () => {
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const historyCache = useRef<HistorySession[] | null>(null);

    // Load last N sessions from Supabase (with messages) to use as AI context
    const loadHistoryContext = useCallback(async (): Promise<HistorySession[]> => {
        if (historyCache.current) return historyCache.current;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: conversations } = await supabase
            .from('conversations')
            .select('id, created_at, mode, target_lang, lang_a')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(MAX_HISTORY_SESSIONS);

        if (!conversations || conversations.length === 0) return [];

        const sessions: HistorySession[] = [];

        for (const conv of conversations) {
            const { data: msgs } = await supabase
                .from('messages')
                .select('original_text, translated_text')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: true });

            const langPair = conv.lang_a
                ? `${conv.lang_a} ↔ ${conv.target_lang}`
                : conv.target_lang || 'Unknown';

            sessions.push({
                date: new Date(conv.created_at).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                }),
                mode: conv.mode || 'chat',
                lang_pair: langPair,
                turns: (msgs || []).map(m => ({
                    original_text: m.original_text || '',
                    translated_text: m.translated_text || '',
                })),
            });
        }

        historyCache.current = sessions;
        return sessions;
    }, []);

    // Send a message and get a response from the assistant
    const sendMessage = useCallback(async (userText: string) => {
        if (!userText.trim()) return;

        const userMsg: AssistantMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userText.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        try {
            const conversationHistory = await loadHistoryContext();

            // Build the last-N message turns for the GPT conversation
            const chatMessages = messages
                .slice(-10) // limit context window
                .map(m => ({ role: m.role, content: m.content }));
            chatMessages.push({ role: 'user', content: userText.trim() });

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const { data, error } = await supabase.functions.invoke('assistant-chat', {
                body: { messages: chatMessages, conversationHistory },
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (error) throw error;

            const assistantMsg: AssistantMessage = {
                id: `${Date.now()}-ai`,
                role: 'assistant',
                content: data.reply || "I'm sorry, I couldn't generate a response.",
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            console.error('❌ Assistant error:', err.message);
            const errMsg: AssistantMessage = {
                id: `${Date.now()}-err`,
                role: 'assistant',
                content: 'I encountered an issue connecting to the assistant. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsThinking(false);
        }
    }, [messages, loadHistoryContext]);

    // Generate a smart summary for a specific session
    const generateSmartSummary = useCallback(async (sessionIndex: number) => {
        const history = await loadHistoryContext();
        if (!history || sessionIndex >= history.length) return;

        const session = history[sessionIndex];
        const turnCount = session.turns.length;

        if (turnCount === 0) {
            await sendMessage(`Please note this session had no recorded turns. Session date: ${session.date}, mode: ${session.mode}.`);
            return;
        }

        const prompt = `Generate a Smart Summary for this session from ${session.date}. Languages: ${session.lang_pair}. Mode: ${session.mode}. It had ${turnCount} turns. Please give me exactly 3 bullet points summarizing the most important information exchanged.`;
        await sendMessage(prompt);
    }, [loadHistoryContext, sendMessage]);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    const invalidateHistoryCache = useCallback(() => {
        historyCache.current = null;
    }, []);

    return {
        messages,
        isThinking,
        sendMessage,
        generateSmartSummary,
        loadHistoryContext,
        clearMessages,
        invalidateHistoryCache,
    };
};
