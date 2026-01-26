import { Stack } from 'expo-router';

export default function AssistantStack() {
    return (
        <Stack>
            <Stack.Screen name='index' options={{ headerShown: false }} />
        </Stack>
    );
}