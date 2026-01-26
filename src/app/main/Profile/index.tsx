import { Box, Text } from '@/src/services/config';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = () => {
    router.replace('/auth');
  };

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
        <Text fontSize={36}>👤</Text>
      </Box>

      <Text variant="heading2" textAlign="center" marginBottom="small">
        Profile
      </Text>

      <Text variant="body" textAlign="center" color="textSecondary" marginBottom="xl">
        Manage your account settings and personal information. This feature is coming soon.
      </Text>

      <Box
        paddingVertical="small"
        paddingHorizontal="medium"
        borderRadius="md"
        backgroundColor="backgroundSecondary"
        marginBottom="xxl"
      >
        <Text variant="body" fontSize={12} fontWeight="bold" letterSpacing={2}>
          COMING SOON
        </Text>
      </Box>

      <TouchableOpacity onPress={handleLogout} style={{ width: '100%', marginTop: 40 }}>
        <Box
          backgroundColor="error"
          padding="medium"
          borderRadius="md"
          alignItems="center"
        >
          <Text variant="body" color="white" fontWeight="bold">
            Logout
          </Text>
        </Box>
      </TouchableOpacity>
    </Box>
  );
}
