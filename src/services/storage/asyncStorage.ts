import AsyncStorage from '@react-native-async-storage/async-storage';


export const saveLocalData = async (key: string, value: any) => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const getLocalData = async (key: string) => {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};
