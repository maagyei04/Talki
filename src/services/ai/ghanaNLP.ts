import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';


const API_KEY = process.env.EXPO_PUBLIC_GHANANLP_API_KEY;
const BASE_URL = 'https://translation-api.ghananlp.org';

const headers = {
    'Ocp-Apim-Subscription-Key': API_KEY || '',
};

export interface GhanaNLPResponse {
    text?: string;
    audioUrl?: string;
    error?: string;
}

/**
 * Maps app language names to GhanaNLP language codes.
 */
const mapLanguageToCode = (language: string): string => {
    switch (language) {
        case 'Akan (Twi)': return 'tw';
        case 'Ga': return 'gaa';
        case 'Ewe': return 'ee';
        case 'Fante': return 'fat';
        case 'Hausa': return 'ha';
        case 'English': return 'en';
        default: return 'en';
    }
};

/**
 * Transcribes audio using GhanaNLP ASR v1.
 */
export const transcribe = async (audioUri: string, language: string): Promise<string> => {
    if (!API_KEY) throw new Error('GhanaNLP API key not found');

    const langCode = mapLanguageToCode(language);
    console.log(`[GhanaNLP] Transcribing with language code: ${langCode}`);

    try {
        // Read file as base64 and convert to binary
        const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));

        const response = await axios.post(`${BASE_URL}/asr/v1/transcribe?language=${langCode}`, audioData, {
            headers: {
                ...headers,
                'Content-Type': 'audio/mpeg', // Documentation mentions audio/mpeg
            },
        });

        if (response.data && response.data.transcription) {
            return response.data.transcription;
        }
        
        // Handle different response structures if needed
        return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (error: any) {
        console.error('[GhanaNLP] Transcription error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Helper to convert ArrayBuffer to Base64 (since Buffer is not global in RN)
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

/**
 * Maps language code to valid GhanaNLP speaker ID.
 */
const mapToSpeakerId = (langCode: string): string => {
    switch (langCode) {
        case 'tw': return 'twi_speaker_4';
        case 'ee': return 'ewe_speaker_3';
        default: return `${langCode}_speaker_1`;
    }
};

/**
 * Synthesizes text to speech using GhanaNLP TTS v1.
 */
export const synthesize = async (text: string, language: string): Promise<string> => {
    if (!API_KEY) throw new Error('GhanaNLP API key not found');

    const langCode = mapLanguageToCode(language);
    const speakerId = mapToSpeakerId(langCode);
    console.log(`[GhanaNLP] Synthesizing with: lang=${langCode}, speaker=${speakerId}`);

    try {
        const response = await axios.post(`${BASE_URL}/tts/v1/synthesize`, {
            text,
            language: langCode,
            speaker_id: speakerId,
        }, {
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
        });


        // Save the audio binary to a local file
        const fileName = `tts_${Date.now()}.wav`;
        const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        const fileUri = `${cacheDir}${fileName}`;
        
        console.log(`[GhanaNLP] Received audio data size: ${response.data.byteLength} bytes`);
        const base64Audio = arrayBufferToBase64(response.data);
        console.log(`[GhanaNLP] Base64 encoded size: ${base64Audio.length} characters`);
        
        await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
            encoding: FileSystem.EncodingType.Base64,
        });

        console.log(`[GhanaNLP] Audio saved to: ${fileUri}`);
        return fileUri;
    } catch (error: any) {

        console.error('[GhanaNLP] Synthesis error:', error.response?.data || error.message);
        throw error;
    }
};


/**
 * Translates text between language pairs supported by GhanaNLP.
 */
export const translate = async (text: string, source: string, target: string): Promise<string> => {
    if (!API_KEY) throw new Error('GhanaNLP API key not found');

    const sourceCode = mapLanguageToCode(source);
    const targetCode = mapLanguageToCode(target);
    const languagePair = `${sourceCode}-${targetCode}`;
    
    console.log(`[GhanaNLP] Translating: ${languagePair}`);

    try {
        const response = await axios.post(`${BASE_URL}/v1/translate`, {
            text,
            language_pair: languagePair,
        }, {
            headers: {
                ...headers,
                'Content-Type': 'application/json',
            },
        });

        // The response format for translation might vary, usually it's a string or { translation: "..." }
        if (typeof response.data === 'string') return response.data;
        if (response.data && response.data.translation) return response.data.translation;
        
        return JSON.stringify(response.data);
    } catch (error: any) {
        console.error('[GhanaNLP] Translation error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Checks if the language is supported for Speech-to-Text.
 */
export const isSupportedSTT = (language: string): boolean => {
    const supported = ['Akan (Twi)', 'Ga', 'Ewe', 'Hausa'];
    return supported.includes(language);
};

/**
 * Checks if the language is supported for Text-to-Speech.
 */
export const isSupportedTTS = (language: string): boolean => {
    const supported = ['Akan (Twi)', 'Ewe'];
    return supported.includes(language);
};

/**
 * Checks if the translation pair is supported by GhanaNLP.
 */
export const isSupportedTranslation = (source: string, target: string): boolean => {
    const ghanaian = ['Akan (Twi)', 'Ga', 'Ewe', 'Hausa'];
    if (source === 'English' && ghanaian.includes(target)) return true;
    if (ghanaian.includes(source) && target === 'English') return true;
    return false;
};

export default { transcribe, synthesize, translate, isSupportedSTT, isSupportedTTS, isSupportedTranslation };



