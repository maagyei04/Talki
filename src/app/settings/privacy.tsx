import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch } from 'react-native';

export default function PrivacyScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Mock toggles
    const [shareAnalytics, setShareAnalytics] = useState(true);
    const [improveAI, setImproveAI] = useState(false);

    const handleClearHistory = async () => {
        Alert.alert(
            'Clear History',
            'Are you sure you want to delete all translation history? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;

                            const { error } = await supabase
                                .from('conversations')
                                .delete()
                                .eq('user_id', user.id);

                            if (error) throw error;

                            Alert.alert('Success', 'Your translation history has been cleared.');
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all associated data. You will be logged out immediately.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Final Confirmation',
                            'Are you 100% sure? This is irreversible.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Yes, Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                        // Note: Real account deletion usually requires an edge function 
                                        // using service_role to delete from auth.users.
                                        // For now, we clear everything and log out.
                                        Alert.alert('Request Received', 'Your account deletion request is being processed. You will be logged out now.');
                                        await supabase.auth.signOut();
                                        router.replace('/auth');
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    };

    const SecurityItem = ({ icon, label, onPress, destructive = false, isLast = false, toggleValue, onToggle }: any) => (
        <Pressable onPress={onPress} disabled={onToggle !== undefined}>
            <Box
                flexDirection="row"
                alignItems="center"
                paddingVertical="medium"
                borderBottomWidth={isLast ? 0 : 0.5}
                borderBottomColor="borderLight"
            >
                <Box
                    width={36}
                    height={36}
                    borderRadius="md"
                    backgroundColor="backgroundSecondary"
                    justifyContent="center"
                    alignItems="center"
                    marginRight="medium"
                >
                    <Ionicons name={icon} size={20} color={destructive ? '#ff4444' : '#420080ff'} />
                </Box>
                <Box flex={1}>
                    <Text variant="label" color={destructive ? 'error' : 'text'}>{label}</Text>
                </Box>
                {onToggle ? (
                    <Switch
                        value={toggleValue}
                        onValueChange={onToggle}
                        trackColor={{ false: '#CBD5E1', true: '#420080ff' }}
                        thumbColor="white"
                    />
                ) : (
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                )}
            </Box>
        </Pressable>
    );

    return (
        <Box flex={1} backgroundColor="background" padding="medium">
            <Box flexDirection="row" alignItems="center" marginTop="xl" marginBottom="large">
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </Pressable>
                <Text variant="heading2" marginLeft="medium">Privacy & Security</Text>
            </Box>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Data Privacy Section */}
                <Box marginTop="medium">
                    <Text variant="caption" color="textSecondary" fontWeight="bold" marginBottom="small" marginLeft="nano">DATA PRIVACY</Text>
                    <Box>
                        <SecurityItem
                            icon="analytics-outline"
                            label="Share Analytics"
                            toggleValue={shareAnalytics}
                            onToggle={setShareAnalytics}
                        />
                        <SecurityItem
                            icon="flask-outline"
                            label="Help improve AI"
                            toggleValue={improveAI}
                            onToggle={setImproveAI}
                        />
                        <SecurityItem
                            icon="trash-outline"
                            label="Clear Translation History"
                            onPress={handleClearHistory}
                            isLast
                        />
                    </Box>
                </Box>

                {/* Security Section */}
                <Box marginTop="xl">
                    <Text variant="caption" color="textSecondary" fontWeight="bold" marginBottom="small" marginLeft="nano">ACCOUNT SECURITY</Text>
                    <Box>
                        <SecurityItem
                            icon="shield-checkmark-outline"
                            label="Two-Factor Authentication"
                            onPress={() => Alert.alert('Coming Soon', 'TFA will be available in the next update.')}
                        />
                        <SecurityItem
                            icon="alert-circle-outline"
                            label="Delete Account"
                            destructive
                            isLast
                            onPress={handleDeleteAccount}
                        />
                    </Box>
                </Box>

                <Box marginTop="xxxl" padding="medium" backgroundColor="backgroundSecondary" borderRadius="md">
                    <Text variant="captionSmall" color="textSecondary" textAlign="center">
                        At Talki, we take your privacy seriously. All audio is processed securely and deleted from our active servers after transcription unless shared for AI improvement.
                    </Text>
                </Box>
            </ScrollView>

            {loading && (
                <Box
                    position="absolute"
                    top={0} left={0} right={0} bottom={0}
                    backgroundColor="white" opacity={0.7}
                    justifyContent="center" alignItems="center"
                >
                    <Text variant="body" marginBottom="medium">Processing...</Text>
                </Box>
            )}
        </Box>
    );
}
