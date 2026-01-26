import { Box, Text } from '@/src/services/config';

export default function AssistantScreen() {
  return (
    <Box
      flex={1}
      backgroundColor="background"
      justifyContent="center"
      alignItems="center"
      padding="xl"
    >
      <Box
        width={80}
        height={80}
        borderRadius="round"
        backgroundColor="primary"
        justifyContent="center"
        alignItems="center"
        marginBottom="large"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        <Text fontSize={36}>✨</Text>
      </Box>

      <Text variant="heading2" textAlign="center" marginBottom="small">
        Assistant
      </Text>

      <Text variant="body" textAlign="center" color="textSecondary" marginBottom="xl">
        Get AI-powered insights, summaries, and personalized help based on your conversations and recordings.
      </Text>

      <Box
        paddingVertical="small"
        paddingHorizontal="medium"
        borderRadius="md"
        backgroundColor="backgroundSecondary"
      >
        <Text variant="body" fontSize={12} fontWeight="bold" letterSpacing={2}>
          COMING SOON
        </Text>
      </Box>
    </Box>
  );
}
