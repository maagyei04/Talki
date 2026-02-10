import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    TextInput
} from 'react-native';

export default function EditProfileScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setFullName(user.user_metadata?.full_name || '');
                setAvatarUrl(user.user_metadata?.avatar_url || null);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadAvatar(result.assets[0].uri);
        }
    };

    const uploadAvatar = async (uri: string) => {
        try {
            setUpdating(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const fileName = `avatar-${user.id}-${Date.now()}.jpg`;
            const filePath = `${user.id}/${fileName}`;

            const formData = new FormData();
            formData.append('file', {
                uri,
                name: fileName,
                type: 'image/jpeg',
            } as any);

            // Upload to 'avatars' bucket
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, formData);

            if (uploadError) {
                // If bucket doesn't exist, this might fail. 
                // In a production app, we'd ensure the bucket exists.
                throw uploadError;
            }

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);
        } catch (error: any) {
            console.error('Upload failed:', error);
            Alert.alert('Upload Error', 'Failed to upload avatar. Please ensure a storage bucket named "avatars" exists in your Supabase project.');
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) {
            Alert.alert('Validation', 'Please enter your full name');
            return;
        }

        try {
            setUpdating(true);
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName.trim(),
                    avatar_url: avatarUrl,
                }
            });

            if (error) throw error;

            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            Alert.alert('Update Error', error.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <Box flex={1} backgroundColor="background" justifyContent="center" alignItems="center">
                <ActivityIndicator size="large" color="#420080ff" />
            </Box>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <Box flex={1} backgroundColor="background">
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    {/* Header */}
                    <Box flexDirection="row" alignItems="center" marginTop="xl" marginBottom="xxl">
                        <Pressable onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={24} color="black" />
                        </Pressable>
                        <Text variant="heading2" marginLeft="medium">Edit Profile</Text>
                    </Box>

                    {/* Avatar Selection */}
                    <Box alignItems="center" marginBottom="xxl">
                        <Pressable onPress={pickImage} disabled={updating}>
                            <Box
                                width={120}
                                height={120}
                                borderRadius="round"
                                backgroundColor="backgroundSecondary"
                                justifyContent="center"
                                alignItems="center"
                                style={{
                                    borderWidth: 2,
                                    borderColor: '#420080ff',
                                    overflow: 'hidden'
                                }}
                            >
                                {updating ? (
                                    <ActivityIndicator color="#420080ff" />
                                ) : avatarUrl ? (
                                    <Image
                                        source={{ uri: avatarUrl }}
                                        style={{ width: '100%', height: '100%' }}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <Ionicons name="person" size={60} color="#CBD5E1" />
                                )}
                                <Box
                                    position="absolute"
                                    bottom={0}
                                    right={0}
                                    backgroundColor="info"
                                    padding="nano"
                                    borderRadius="md"
                                    style={{ margin: 4 }}
                                >
                                    <Ionicons name="camera" size={16} color="white" />
                                </Box>
                            </Box>
                        </Pressable>
                        <Text variant="caption" color="textSecondary" marginTop="small">Tap to change photo</Text>
                    </Box>

                    {/* Input Fields */}
                    <Box marginBottom="large">
                        <Text variant="label" color="textSecondary" marginBottom="nano">FULL NAME</Text>
                        <TextInput
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Enter your full name"
                            placeholderTextColor="#94A3B8"
                            style={{
                                borderBottomWidth: 1,
                                borderBottomColor: '#E2E8F0',
                                paddingVertical: 12,
                                fontSize: 16,
                                color: '#1E293B',
                                fontFamily: 'Poppins_400Regular'
                            }}
                        />
                    </Box>

                    {/* Save Button */}
                    <Pressable onPress={handleUpdateProfile} disabled={updating}>
                        <Box
                            backgroundColor={updating ? 'backgroundTertiary' : 'info'}
                            padding="medium"
                            borderRadius="lg"
                            alignItems="center"
                            marginTop="xl"
                        >
                            {updating ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text color="white" fontWeight="bold">Update Profile</Text>
                            )}
                        </Box>
                    </Pressable>
                </ScrollView>
            </Box>
        </KeyboardAvoidingView>
    );
}
