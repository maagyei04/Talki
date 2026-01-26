export interface EnvironmentConfig {
    apiBaseUrl: string;
    environment: 'development' | 'staging' | 'production';
    appName: string;
    isDevelopment: boolean;
    isStaging: boolean;
    isProduction: boolean;
}

const getEnvironmentConfig = (): EnvironmentConfig => {
    const environment = (process.env.EXPO_PUBLIC_ENVIRONMENT || 'development') as 'development' | 'staging' | 'production';
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    const appName = process.env.EXPO_PUBLIC_APP_NAME || 'Talki';

    return {
        apiBaseUrl,
        environment,
        appName,
        isDevelopment: environment === 'development',
        isStaging: environment === 'staging',
        isProduction: environment === 'production',
    };
};

export const environmentConfig = getEnvironmentConfig();