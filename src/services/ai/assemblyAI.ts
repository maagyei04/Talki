import axios from 'axios';

const baseUrl = 'https://api.assemblyai.com';
const API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;

if (!API_KEY) {
    console.error("EXPO_PUBLIC_ASSEMBLYAI_API_KEY is not defined in .env");
}

const headers = {
    authorization: API_KEY || '',
};

export interface TranscriptionResponse {
    text: string;
    languageCode: string;
}

/**
 * Transcribes an audio file given its local URI using the AssemblyAI REST API.
 * Follows the Axios structure and polling logic requested.
 * @param audioUri The local URI of the audio file to transcribe.
 * @returns An object containing the transcribed text and detected language code.
 */
export const transcribeAudio = async (audioUri: string): Promise<TranscriptionResponse> => {
    try {
        console.log("Starting transcription for:", audioUri);

        // 1. Upload the file to AssemblyAI
        const uploadResponse = await fetch(`${baseUrl}/v2/upload`, {
            method: 'POST',
            headers: {
                ...headers,
                'content-type': 'application/octet-stream',
            },
            body: {
                uri: audioUri,
                type: 'audio/m4a',
                name: 'audio.m4a',
            } as any,
        });

        const uploadData = await uploadResponse.json();
        const audioUrl = uploadData.upload_url;

        if (!audioUrl) {
            throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
        }

        console.log("File uploaded, URL:", audioUrl);

        // 2. Request transcription using axios
        const data = {
            audio_url: audioUrl,
            speech_models: ["universal"],
            language_detection: true,
        };

        const response = await axios.post(`${baseUrl}/v2/transcript`, data, { headers });
        const transcriptId = response.data.id;
        const pollingEndpoint = `${baseUrl}/v2/transcript/${transcriptId}`;

        console.log("Transcription requested, ID:", transcriptId);

        // 3. Poll for result using axios
        while (true) {
            const pollingResponse = await axios.get(pollingEndpoint, { headers });
            const transcriptionResult = pollingResponse.data;

            if (transcriptionResult.status === 'completed') {
                console.log("Transcription completed: " + transcriptionResult.text);
                console.log("Transcription language: " + transcriptionResult.language_code);
                return {
                    text: transcriptionResult.text || "",
                    languageCode: transcriptionResult.language_code || "unknown"
                };
            } else if (transcriptionResult.status === 'error') {
                throw new Error(`Transcription failed: ${transcriptionResult.error}`);
            } else {
                console.log(`Transcription status: ${transcriptionResult.status}. Polling...`);
                await new Promise((resolve) => setTimeout(resolve, 3000));
            }
        }
    } catch (error) {
        console.error("Transcription error:", error);
        throw error;
    }
};

export default { transcribeAudio };
