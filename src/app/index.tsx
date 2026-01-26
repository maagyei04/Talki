import { useRouter } from "expo-router";
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

const { height } = Dimensions.get('window');

const Index = () => {
    const router = useRouter();
    const [splashFinished, setSplashFinished] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSplashFinished(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (splashFinished) {
            router.replace('/auth');
        }
    }, [splashFinished, router]);

    if (!splashFinished) {
        return <SplashAnimation />;
    }

    return null;
}

export default Index;

export const SplashAnimation = () => {
    const mainContentPosition = useSharedValue(height / 2);

    const appName = "Talki";
    const subText = "High-performance AI for seamless communication";

    const mainContentStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            left: 0,
            right: 0,
            alignItems: 'center',
            transform: [
                { translateY: mainContentPosition.value - height / 2 },
            ],
            gap: 20
        };
    });

    useEffect(() => {
        mainContentPosition.value = height * 0.75;
        setTimeout(() => {
            mainContentPosition.value = withSpring(height / 2, {
                damping: 12,
                stiffness: 100
            });
        }, 1500);
    }, [mainContentPosition]);

    return (
        <View style={styles.splashContainer}>
            <LottieView
                source={require('@assets/animations/life.json')}
                autoPlay
                style={styles.lottieBackground}
                resizeMode="cover"
                colorFilters={[
                    {
                        keypath: "bg",
                        color: "#ffffffff"
                    },
                    {
                        keypath: "bg green",
                        color: "#000000ed"
                    },
                    {
                        keypath: "bg green 2",
                        color: "#aaaaaaca"
                    },
                    {
                        keypath: "BaseCircle_03",
                        color: "#ffffffb6"
                    }
                ]}
            />

            <Animated.View style={mainContentStyle}>
                <Animated.View style={[styles.appNameContainer]}>
                    {appName.split('').map((char, index) => (
                        <Animated.Text key={index} style={[styles.appNameChar]}>
                            {char}
                        </Animated.Text>
                    ))}
                </Animated.View>
            </Animated.View>

            <View style={styles.subTextContainer}>
                <Animated.Text style={[styles.subText, { textAlign: 'center', width: '80%' }]}>
                    {subText}
                </Animated.Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    splashContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        overflow: 'hidden'
    },
    lottieBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%'
    },
    subTextContainer: {
        position: 'absolute',
        bottom: 50,
        alignItems: 'center',
        width: '100%'
    },
    appIcon: {
        width: 100,
        height: 100,
        resizeMode: 'contain'
    },
    appNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    appNameChar: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5
    },
    subText: {
        fontSize: 15,
        color: '#494949FF',
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3
    }
});
