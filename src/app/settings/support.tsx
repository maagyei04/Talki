import { Box, Text } from '@/src/services/config';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

export default function SupportScreen() {
    const router = useRouter();

    const openLink = async (url: string) => {
        await WebBrowser.openBrowserAsync(url);
    };

    const sendEmail = () => {
        Linking.openURL('mailto:support@talki.ai?subject=Support Request&body=Hi Talki Team,');
    };

    const SupportItem = ({ icon, label, onPress, isLast = false, color = '#420080ff' }: any) => (
        <Pressable onPress={onPress}>
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
                    <Ionicons name={icon} size={20} color={color} />
                </Box>
                <Box flex={1}>
                    <Text variant="label" color="text">{label}</Text>
                </Box>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </Box>
        </Pressable>
    );

    return (
        <Box flex={1} backgroundColor="background" padding="medium">
            <Box flexDirection="row" alignItems="center" marginTop="xl" marginBottom="large">
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </Pressable>
                <Text variant="heading2" marginLeft="medium">Support</Text>
            </Box>

            <ScrollView showsVerticalScrollIndicator={false}>
                <Box marginTop="medium">
                    <Text variant="caption" color="textSecondary" fontWeight="bold" marginBottom="small" marginLeft="nano">HELP & FEEDBACK</Text>
                    <Box>
                        <SupportItem
                            icon="book-outline"
                            label="Help Center"
                            onPress={() => openLink('https://talki.ai/help')}
                        />
                        <SupportItem
                            icon="mail-outline"
                            label="Contact Support"
                            onPress={sendEmail}
                        />
                        <SupportItem
                            icon="chatbubble-outline"
                            label="Community Discord"
                            onPress={() => openLink('https://discord.gg/talki')}
                        />
                        <SupportItem
                            icon="bug-outline"
                            label="Report a Bug"
                            onPress={() => openLink('https://talki.ai/feedback')}
                            isLast
                        />
                    </Box>
                </Box>

                <Box marginTop="xl">
                    <Text variant="caption" color="textSecondary" fontWeight="bold" marginBottom="small" marginLeft="nano">LEGAL</Text>
                    <Box>
                        <SupportItem
                            icon="document-text-outline"
                            label="Terms of Service"
                            onPress={() => openLink('https://talki.ai/terms')}
                        />
                        <SupportItem
                            icon="shield-outline"
                            label="Privacy Policy"
                            onPress={() => openLink('https://talki.ai/privacy')}
                            isLast
                        />
                    </Box>
                </Box>

                <Box marginTop="xl" alignItems="center">
                    <Text variant="captionSmall" color="textDisabled">Talki AI for iOS & Android</Text>
                    <Text variant="captionSmall" color="textDisabled">Version 1.0.0 (Build 20260210)</Text>
                </Box>
            </ScrollView>
        </Box>
    );
}

const styles = StyleSheet.create({});
