import { Box, Text } from '@/src/services/config';
import { HistoryFilter, HistoryMessage, HistorySession, useHistory } from '@/src/shared/hooks/useHistory';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { useTranslation } from 'react-i18next';
import { I18nManager } from 'react-native';

const ACCENT = '#420080ff';

function formatDate(iso: string, t: any) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return t('history.date.justNow', 'Just now');
    if (diff < 3600) return t('history.date.m_ago', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('history.date.h_ago', { count: Math.floor(diff / 3600) });
    if (diff < 172800) return t('history.date.yesterday', 'Yesterday');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function langLabel(session: HistorySession, t: any) {
    if (session.mode === 'live' && session.lang_a) {
        const la = t(`common.${session.lang_a.toLowerCase()}`, session.lang_a);
        const lb = t(`common.${session.target_lang.toLowerCase()}`, session.target_lang);
        return `${la} ↔ ${lb}`;
    }
    return t(`common.${session.target_lang.toLowerCase()}`, session.target_lang || 'Unknown');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterTabs({
    active,
    onChange,
}: {
    active: HistoryFilter;
    onChange: (f: HistoryFilter) => void;
}) {
    const { t } = useTranslation();
    const tabs: { key: HistoryFilter; label: string }[] = [
        { key: 'all', label: t('common.all', 'All') },
        { key: 'chat', label: t('home.chat', 'Chat') },
        { key: 'live', label: t('home.live', 'Live') },
    ];
    return (
        <Box flexDirection="row" marginHorizontal="medium" marginBottom="medium">
            {tabs.map(t => (
                <Pressable
                    key={t.key}
                    onPress={() => onChange(t.key)}
                    style={[styles.tab, active === t.key && styles.tabActive]}
                >
                    <Text
                        variant="caption"
                        fontWeight="bold"
                        style={{ color: active === t.key ? '#fff' : '#64748B' }}
                    >
                        {t.label.toUpperCase()}
                    </Text>
                </Pressable>
            ))}
        </Box>
    );
}

function TurnRow({
    msg,
    index,
    onDelete
}: {
    msg: HistoryMessage;
    index: number;
    onDelete: (id: string) => void;
}) {
    const { t } = useTranslation();
    const confirmDelete = () => {
        Alert.alert(t('history.turnDelete'), t('history.turnDeleteConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(msg.id) },
        ]);
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 40)}
            exiting={FadeOut}
            style={styles.turnRow}
        >
            <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                    <Box style={[styles.turnOriginal, I18nManager.isRTL && styles.turnRowRtl]}>
                        <Text variant="captionSmall" color="textSecondary" fontWeight="bold" marginBottom="nano" textAlign={I18nManager.isRTL ? 'right' : 'left'}>
                            {t('history.labels.said', 'SAID')}
                        </Text>
                        <Text variant="bodySmall" color="text" textAlign={I18nManager.isRTL ? 'right' : 'left'}>{msg.original_text}</Text>
                    </Box>
                    <Box style={styles.turnArrow}>
                        <Ionicons name="arrow-down" size={14} color={ACCENT} />
                    </Box>
                    <Box style={[styles.turnTranslated, I18nManager.isRTL && styles.turnRowRtl]}>
                        <Text variant="captionSmall" style={{ color: ACCENT }} fontWeight="bold" marginBottom="nano" textAlign={I18nManager.isRTL ? 'right' : 'left'}>
                            {t('history.labels.translated', 'TRANSLATED')}
                        </Text>
                        <Text variant="bodySmall" color="text" textAlign={I18nManager.isRTL ? 'right' : 'left'}>{msg.translated_text}</Text>
                    </Box>
                </Box>
                <TouchableOpacity onPress={confirmDelete} style={[styles.turnDeleteBtn, I18nManager.isRTL ? { marginRight: 8, marginLeft: 0 } : { marginLeft: 8, marginRight: 0 }]}>
                    <Ionicons name="trash-outline" size={16} color="#CBD5E1" />
                </TouchableOpacity>
            </Box>
        </Animated.View>
    );
}

function SessionCard({
    session,
    fetchMessages,
    onDelete,
    onDeleteMessage
}: {
    session: HistorySession;
    fetchMessages: (id: string) => Promise<HistoryMessage[]>;
    onDelete: (id: string) => void;
    onDeleteMessage: (msgId: string) => void;
}) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [messages, setMessages] = useState<HistoryMessage[]>([]);
    const [loadingMsgs, setLoadingMsgs] = useState(false);

    const toggle = async () => {
        if (!expanded && messages.length === 0) {
            setLoadingMsgs(true);
            const msgs = await fetchMessages(session.id);
            setMessages(msgs);
            setLoadingMsgs(false);
        }
        setExpanded(prev => !prev);
    };

    const confirmDelete = () =>
        Alert.alert(t('history.deleteConfirm'), t('history.deleteConfirmDesc'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(session.id) },
        ]);

    const handleTurnDelete = (msgId: string) => {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        onDeleteMessage(msgId);
    };

    const isLive = session.mode === 'live';

    return (
        <Animated.View entering={FadeInDown} style={styles.card}>
            <Pressable onPress={toggle} onLongPress={confirmDelete}>
                <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} alignItems="center">
                    <Box style={[styles.modeBadge, { backgroundColor: isLive ? ACCENT : '#000' }]}>
                        {isLive
                            ? <MaterialCommunityIcons name="broadcast" size={14} color="#fff" />
                            : <MaterialCommunityIcons name="chat-processing-outline" size={14} color="#fff" />
                        }
                    </Box>

                    <Box flex={1} marginLeft={I18nManager.isRTL ? "none" : "small"} marginRight={I18nManager.isRTL ? "small" : "none"}>
                        <Text variant="label" color="text" fontWeight="bold" textAlign={I18nManager.isRTL ? 'right' : 'left'}>
                            {langLabel(session, t)}
                        </Text>
                        <Text variant="captionSmall" color="textSecondary" marginTop="nano" textAlign={I18nManager.isRTL ? 'right' : 'left'}>
                            {formatDate(session.created_at, t)} · {session.message_count} {t('history.turns', { count: session.message_count })}
                        </Text>
                    </Box>

                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#94A3B8"
                    />
                </Box>
            </Pressable>

            {expanded && (
                <Box marginTop="medium" borderTopWidth={0.5} borderTopColor="borderLight" paddingTop="medium">
                    {loadingMsgs
                        ? <ActivityIndicator size="small" color={ACCENT} />
                        : messages.length === 0
                            ? <Text variant="caption" color="textSecondary" textAlign="center">{t('history.noTurns', 'No turns found.')}</Text>
                            : messages.map((m, i) => (
                                <TurnRow
                                    key={m.id}
                                    msg={m}
                                    index={i}
                                    onDelete={handleTurnDelete}
                                />
                            ))
                    }
                </Box>
            )}
        </Animated.View>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: HistoryFilter }) {
    const { t } = useTranslation();
    const label =
        filter === 'live' ? t('history.emptyLive', 'No live sessions yet')
            : filter === 'chat' ? t('history.emptyChat', 'No chat sessions yet')
                : t('history.empty', 'No translations yet');
    return (
        <Box flex={1} justifyContent="center" alignItems="center" padding="xl" opacity={0.6}>
            <MaterialCommunityIcons name="history" size={64} color="#CBD5E1" />
            <Text variant="subheading" color="textSecondary" textAlign="center" marginTop="large">
                {label}
            </Text>
            <Text variant="bodySmall" color="textSecondary" textAlign="center" marginTop="small">
                {t('history.subtitle', 'Start a session on the Home screen to see your history here.')}
            </Text>
        </Box>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<HistoryFilter>('all');
    const { sessions, isLoading, refresh, fetchMessages, deleteSession, deleteMessage, clearAll } = useHistory(filter);
    const tabBarHeight = useBottomTabBarHeight();

    const handleDelete = useCallback(async (id: string) => {
        await deleteSession(id);
    }, [deleteSession]);

    const handleClearAll = () => {
        Alert.alert(
            t('history.clearAllConfirmTitle', 'Clear All History'),
            t('history.clearAllConfirmDesc', 'This will permanently delete ALL your translations and sessions. are you sure?'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('history.clearAll', 'Clear All'), style: 'destructive', onPress: clearAll },
            ]
        );
    };

    const renderItem = useCallback(({ item }: { item: HistorySession }) => (
        <SessionCard
            session={item}
            fetchMessages={fetchMessages}
            onDelete={handleDelete}
            onDeleteMessage={deleteMessage}
        />
    ), [fetchMessages, handleDelete, deleteMessage, t]);

    return (
        <Box flex={1} backgroundColor="background">
            {/* Header */}
            <Box
                paddingHorizontal="medium"
                paddingTop="xxxl"
                borderBottomWidth={0.5}
                borderBottomColor="borderLight"
                backgroundColor="background"
            >
                <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} justifyContent="space-between" alignItems="center" marginBottom="medium">
                    <Text variant="heading2" color="text">{t('history.title', 'History')}</Text>
                    {sessions.length > 0 && (
                        <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
                            <Text variant="captionSmall" color="danger" fontWeight="bold">{t('history.clearAll', 'CLEAR ALL').toUpperCase()}</Text>
                        </TouchableOpacity>
                    )}
                </Box>
                <FilterTabs active={filter} onChange={setFilter} />
            </Box>

            {isLoading ? (
                <Box flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator size="large" color={ACCENT} />
                </Box>
            ) : sessions.length === 0 ? (
                <EmptyState filter={filter} />
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={refresh}
                            tintColor={ACCENT}
                        />
                    }
                    ListFooterComponent={<View style={{ height: tabBarHeight + 40 }} />}
                />
            )}
        </Box>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    listContent: {
        padding: 16,
        paddingTop: 20,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 999,
        alignItems: 'center',
        marginHorizontal: 3,
        backgroundColor: '#F1F5F9',
    },
    tabActive: {
        backgroundColor: ACCENT,
    },
    clearBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#fee2e2',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
    },
    modeBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    turnRow: {
        marginBottom: 14,
    },
    turnOriginal: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#CBD5E1',
    },
    turnRowRtl: {
        borderLeftWidth: 0,
        borderRightWidth: 3,
        borderRightColor: '#CBD5E1',
    },
    turnArrow: {
        alignItems: 'center',
        marginVertical: 4,
    },
    turnTranslated: {
        backgroundColor: 'rgba(66,0,128,0.05)',
        borderRadius: 10,
        padding: 10,
        borderLeftWidth: 3,
        borderLeftColor: ACCENT,
    },
    turnDeleteBtn: {
        padding: 8,
        marginLeft: 8,
    },
});
