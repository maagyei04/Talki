# Talki 🗣️

Talki is a high-performance AI personal language assistant specifically designed for immigrants. It goes beyond simple translation to provide a comprehensive communication toolkit, helping users navigate new environments with confidence.

## Visual Preview

<p align="center">
  <img src="./src/assets/images/screenshot1.jpg" width="30%" />
  <img src="./src/assets/images/screenshot2.jpg" width="30%" />
  <img src="./src/assets/images/screenshot3.jpg" width="30%" />
</p>

## Key Features

-   **High-Performance Translation**: Instant, accurate translation to break language barriers in real-time.
-   **Conversation Transcription**: Automatically transcribes your conversations, ensuring you never miss a detail from important meetings or appointments.
-   **Smart Actions**: AI-powered extraction of "Smart Actions" (deadlines, appointments, reminders) directly from your transcribed interactions.
-   **Immigrant-Centric Design**: Tailored to the unique needs of individuals navigating new languages and cultures.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Expo Go](https://expo.dev/go) app on your mobile device (to run on physical hardware)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Talki
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your AssemblyAI API key:
   ```env
   EXPO_PUBLIC_ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
   ```

4. Start the development server:
   ```bash
   npx expo start
   ```

## AI Service Setup

Talki uses **AssemblyAI** for its state-of-the-art transcription and language detection. To get your API key:

1. Sign up at [AssemblyAI](https://www.assemblyai.com/).
2. Copy your API key from the dashboard.
3. Add it to your `.env` file as shown above.

### Usage

Once the development server is running, you can:
- Scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS) to run the app on your physical device.
- Press `a` for Android Emulator.
- Press `i` for iOS Simulator.
- Press `w` for the Web version.

## Tech Stack

- **Framework**: [Expo](https://expo.dev/) (React Native)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/)
- **Styling**: [Shopify Restyle](https://github.com/Shopify/restyle)
- **Animation**: [Lottie](https://lottiereactnative.dev/) & [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)

## Learn More

To learn more about the tools used in this project:
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router Guide](https://docs.expo.dev/router/introduction/)

---
Created by [Agyei Michael Addai (Michantech)](https://www.linkedin.com/in/michael-addai-agyei)
