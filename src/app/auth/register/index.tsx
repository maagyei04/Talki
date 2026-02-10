import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { useTheme } from '@/src/shared/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

export default function RegisterScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!email || !password || !fullName) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                },
            });

            if (error) throw error;

            if (data.user && data.session === null) {
                Alert.alert('Success', 'Please check your email for a verification link!');
                router.replace('/auth/login');
            } else if (data.session) {
                router.replace('/main/Home');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: theme.colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Box paddingTop="xxxl" paddingHorizontal="medium">
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </Pressable>

                    <Text variant="heading" marginTop="medium" color="black">
                        Create Account
                    </Text>
                    <Text variant="body" color="textSecondary" marginTop="tiny">
                        Join Talki and start translating your world.
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text variant="caption" color="textSecondary" marginBottom="tiny">FULL NAME</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="John Doe"
                                value={fullName}
                                onChangeText={setFullName}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text variant="caption" color="textSecondary" marginBottom="tiny">EMAIL ADDRESS</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="name@example.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text variant="caption" color="textSecondary" marginBottom="tiny">PASSWORD</Text>
                            <View style={[styles.input, styles.passwordInputContainer]}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="••••••••"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color="#94A3B8"
                                    />
                                </Pressable>
                            </View>
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.primaryButton,
                                {
                                    backgroundColor: loading
                                        ? theme.colors.primaryLight
                                        : (pressed ? theme.colors.primaryDark : theme.colors.primary)
                                },
                            ]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text variant="button" color="white">Sign Up</Text>
                            )}
                        </Pressable>
                    </View>

                    <Box flexDirection="row" justifyContent="center" marginTop="large" marginBottom="xxxl">
                        <Text variant="body" color="textSecondary">Already have an account? </Text>
                        <Pressable onPress={() => router.push('/auth/login')}>
                            <Text variant="body" color="info" fontWeight="bold">Login</Text>
                        </Pressable>
                    </Box>
                </Box>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    form: {
        marginTop: 40,
        gap: 24,
    },
    inputContainer: {
        gap: 4,
    },
    input: {
        height: 56,
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 0,
    },
    passwordInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
    },
    eyeIcon: {
        paddingHorizontal: 16,
        height: '100%',
        justifyContent: 'center',
    },
    primaryButton: {
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
});
