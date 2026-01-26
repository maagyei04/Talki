import { Text } from '@/src/services/config';
import { useTheme } from '@/src/shared/contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    BackHandler,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    View
} from 'react-native';

const SLIDES = [
    {
        title: "Speak with confidence in any language.",
        subtext: "Talki translates your conversations in real-time, helping you navigate your new home with ease."
    },
    {
        title: "Capture every detail of your conversations.",
        subtext: "Get instant transcripts of important meetings, appointments, and daily interactions."
    },
    {
        title: "Stay organized with Smart Actions.",
        subtext: "Talki automatically extracts deadlines and appointments, so you never miss an important date."
    }
];

export default function AuthIndex() {
    const router = useRouter();
    const { theme } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => true;
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    useEffect(() => {
        const timer = setInterval(() => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start(() => {
                setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }).start();
            });
        }, 4000);

        return () => clearInterval(timer);
    }, [fadeAnim]);

    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            {/* Background Image Container */}
            <View style={StyleSheet.absoluteFill}>
                <Image
                    source={require('@assets/images/auth25.jpg')}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                />
                <BlurView
                    intensity={0}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                    experimentalBlurMethod="dimezisBlurView"
                />
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={['rgba(0,0,0,0.97)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.53)', 'rgba(0, 0, 0, 0.12)']}
                        locations={[0, 0.35, 0.7, 1]}
                        start={{ x: 0.5, y: 1 }}
                        end={{ x: 0.5, y: 0 }}
                        style={styles.gradientOverlay}
                    />
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: 'transparent' }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >

                <View style={styles.logoContainerSmall} pointerEvents="none">
                    <Text variant="heading2" style={{ color: theme.colors.white, fontWeight: 'bold' }}>
                        Talki
                    </Text>
                </View>

                <View style={[styles.inner, { justifyContent: 'flex-end', flex: 1, paddingBottom: 40 }]}>
                    <Animated.View style={{ opacity: fadeAnim }}>
                        <View style={styles.headerContainer}>
                            <Text
                                variant="heading"
                                style={[styles.title, { color: theme.colors.white, textAlign: 'left' }]}
                            >
                                {SLIDES[currentIndex].title}
                            </Text>
                        </View>
                        <View style={styles.agreementContainer}>
                            <Text
                                variant="caption"
                                color="textDisabled"
                                style={[styles.agreementText, { textAlign: 'left' }]}
                            >
                                {SLIDES[currentIndex].subtext}
                            </Text>
                        </View>
                    </Animated.View>

                    <View style={styles.form}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.primary,
                                {
                                    backgroundColor: pressed
                                        ? theme.colors.primary2 || theme.colors.primary
                                        : theme.colors.white,
                                },
                            ]}
                            onPress={() => router.push('/main/Home')}
                        >
                            <Text variant="body" color="black">Get Started</Text>
                        </Pressable>
                        <Pressable
                            style={styles.signInPressable}
                        >
                            <Text variant="body" style={{ color: theme.colors.white, textAlign: 'center', opacity: 0.7 }}>
                                v1.0.0 Talki
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    inner: {
        paddingHorizontal: 15,
        paddingVertical: 32,
        flex: 1,
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    logoContainerSmall: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 10,
    },
    logoSmall: {
        width: 120,
        height: 120,
    },
    headerContainer: {
        marginBottom: 12,
    },
    title: {
        fontSize: 32,
        lineHeight: 40,
    },
    agreementContainer: {
        marginBottom: 40,
    },
    agreementText: {
        fontSize: 16,
        lineHeight: 24,
    },
    form: {
        gap: 16,
    },
    primary: {
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    signInPressable: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
});