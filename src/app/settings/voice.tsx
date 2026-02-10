import { Box, Text } from '@/src/services/config';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

export default function VoiceScreen() {
    const router = useRouter();

    return (
        <Box flex={1} backgroundColor="background" padding="medium">
            <Box flexDirection="row" alignItems="center" marginTop="xl" marginBottom="large">
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </Pressable>
                <Text variant="heading2" marginLeft="medium">Preferred Voice</Text>
            </Box>
            <Box flex={1} justifyContent="center" alignItems="center" opacity={0.5}>
                <Ionicons name="mic-outline" size={80} color="gray" />
                <Text variant="body" marginTop="medium">Voice selection coming soon!</Text>
            </Box>
        </Box>
    );
}
