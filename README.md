# Hey Agora Voice Assistant

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Agora](https://img.shields.io/badge/Agora-RTC-blue)

A voice-controlled AI assistant that uses wake word detection, real-time voice communication, and conversational AI to provide a hands-free assistant experience.

## Features

- ✨ **Wake Word Detection**: Activate with "Hey Agora" without touching any controls
- 🎤 **Real-time Voice Communication**: Uses Agora RTC for high-quality audio streaming
- 🤖 **Conversational AI Integration**: Connects to AI agents for natural interactions
- 🔊 **Audio Level Monitoring**: Detects when users or AI agents are speaking
- 🔄 **Automatic Session Management**: Handles connection/disconnection based on activity
- 📱 **Responsive Design**: Works across devices with a clean, minimalist interface

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Agora account with App ID and token generation capability
- Web browser with microphone access

### Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
```

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/hey_agora.git
cd hey_agora

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Grant microphone access when prompted
2. Wait for the "Listening for 'Hey Agora'..." message
3. Say "Hey Agora" to activate the assistant
4. Speak your question or command
5. The AI agent will respond through audio
6. Conversation ends automatically after silence

## How It Works

The application uses a multi-layer architecture:

1. **Front-end UI**: Next.js React components for the user interface
2. **Wake Word Detection**: Uses the wake-word-command library to detect the activation phrase
3. **Voice Connection**: Agora RTC SDK for real-time audio communication
4. **Conversational AI**: Backend service that processes speech and generates responses

## Technologies

- [Next.js](https://nextjs.org/) - React framework
- [Agora RTC SDK](https://www.agora.io/en/) - Real-time communication
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - Browser speech recognition
- [Wake Word Command](https://www.npmjs.com/package/wake-word-command) - Wake word detection

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Special thanks to the Agora team for their excellent SDK
- All contributors who have helped shape this project
