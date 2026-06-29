import { supabase } from '@/src/services/supabase';
import { useCallback, useEffect, useState } from 'react';

export type HistoryFilter = 'all' | 'chat' | 'live';

export interface HistoryMessage {
    id: string;
    original_text: string;
    translated_text: string;
    speaker: string;
    created_at: string;
    audio_url?: string | null;
}

export interface HistorySession {
    id: string;
    mode: 'chat' | 'live';
    target_lang: string;
    lang_a: string | null;
    created_at: string;
    message_count: number;
}

export const useHistory = (filter: HistoryFilter = 'all') => {
    const [sessions, setSessions] = useState<HistorySession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            let query = supabase
                .from('conversations')
                .select('id, mode, target_lang, lang_a, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (filter === 'chat') query = query.eq('mode', 'chat');
            if (filter === 'live') query = query.eq('mode', 'live');

            const { data: convData, error: convErr } = await query;
            if (convErr) {
                console.error('❌ Error fetching sessions:', convErr.message, convErr.details);
                throw convErr;
            }
            if (!convData || convData.length === 0) { setSessions([]); return; }

            // Fetch message count for each conversation
            const ids = convData.map(c => c.id);
            const { data: msgCounts, error: cntErr } = await supabase
                .from('messages')
                .select('conversation_id')
                .in('conversation_id', ids);

            if (cntErr) throw cntErr;

            const countMap: Record<string, number> = {};
            (msgCounts || []).forEach(m => {
                countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
            });

            setSessions(convData.map(c => ({
                id: c.id,
                mode: (c.mode || 'chat') as 'chat' | 'live',
                target_lang: c.target_lang || '',
                lang_a: c.lang_a || null,
                created_at: c.created_at,
                message_count: countMap[c.id] || 0,
            })).filter(s => s.message_count > 0)); // hide sessions with no messages
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    const fetchMessages = useCallback(async (conversationId: string): Promise<HistoryMessage[]> => {
        const { data, error: err } = await supabase
            .from('messages')
            .select('id, original_text, translated_text, speaker, created_at, audio_url')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        if (err) { console.error('fetchMessages error:', err.message); return []; }
        return data || [];
    }, []);

    const deleteSession = useCallback(async (conversationId: string) => {
        console.log('🗑️ Deleting session:', conversationId);
        const { error: msgErr } = await supabase.from('messages').delete().eq('conversation_id', conversationId);
        if (msgErr) console.error('❌ Error deleting session messages:', msgErr.message);

        const { error: convErr } = await supabase.from('conversations').delete().eq('id', conversationId);
        if (convErr) console.error('❌ Error deleting conversation:', convErr.message);
        
        if (!msgErr && !convErr) {
            console.log('✅ Session deleted from Supabase');
            setSessions(prev => prev.filter(s => s.id !== conversationId));
        }
    }, []);

    const deleteMessage = useCallback(async (messageId: string) => {
        console.log('🗑️ Deleting message:', messageId);
        const { error } = await supabase.from('messages').delete().eq('id', messageId);
        if (error) console.error('❌ Error deleting message:', error.message);
        else console.log('✅ Message deleted from Supabase');
    }, []);

    const clearAll = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('🗑️ Clearing ALL history for user:', user.id);
        const { data: convIds, error: fetchErr } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', user.id);

        if (fetchErr) {
            console.error('❌ Error fetching conversation IDs for clear all:', fetchErr.message);
            return;
        }

        if (convIds && convIds.length > 0) {
            const ids = convIds.map(c => c.id);
            const { error: msgErr } = await supabase.from('messages').delete().in('conversation_id', ids);
            const { error: convErr } = await supabase.from('conversations').delete().in('id', ids);
            
            if (msgErr) console.error('❌ Error clearing messages:', msgErr.message);
            if (convErr) console.error('❌ Error clearing conversations:', convErr.message);
            
            if (!msgErr && !convErr) {
                console.log('✅ All history cleared from Supabase');
                setSessions([]);
            }
        } else {
            console.log('No history to clear.');
            setSessions([]);
        }
    }, []);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    return { sessions, isLoading, error, refresh: fetchSessions, fetchMessages, deleteSession, deleteMessage, clearAll };
};
