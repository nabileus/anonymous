# Anonymous Telegram Bot

This bot performs two main functions:

1. **Audio Processing**: Applies a "Death Note L" voice effect to audio/voice messages.
2. **Handwriting Generation**: Converts text into handwritten-style images on a template.

## Implementations

This project contains two versions of the bot:

- **Node.js (Recommended)**: Designed for serverless deployment on Vercel or local development.
- **Python**: Designed for long-polling on a traditional server.

---

## 🚀 Hosting on Vercel (Node.js)

The Node.js version is optimized for Vercel using Webhooks.

### 1. Prerequisites

- A [Vercel](https://vercel.com/) account.
- [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`).
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather).

### 2. Deployment

1. Clone the repository and navigate to the project folder.
2. Run `vercel` to deploy:

   ```shell
   vercel
   ```

3. After deployment, you will get a production URL (e.g., `https://your-bot.vercel.app`).

### 3. Environment Variables

In your Vercel Project Dashboard, add the following environment variables:

- `TELEGRAM_BOT_TOKEN`: Your bot token.
- `CHANNEL_ID`: (Optional) The ID of the channel to log messages to (e.g., `-100123456789`).

### 4. Setting the Webhook

You must tell Telegram where to send updates. Replace `<TOKEN>` and `<URL>` in the following link and open it in your browser:
`https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/webhook`

---

## 💻 Local Development (Node.js)

1. Install dependencies:

   ```shell
   npm install
   ```

2. Create a `.env` file with your `TELEGRAM_BOT_TOKEN` and `CHANNEL_ID`.
3. Run the development server (uses long-polling):

   ```shell
   npm run dev
   ```

---

## 🐍 Python Version (Long Polling)

1. Install dependencies:

   ```shell
   pip install -r requirements.txt
   ```

2. Create a `.env` file with your `TELEGRAM_BOT_TOKEN` and `CHANNEL_ID`.
3. Run the bot:

   ```shell
   python main.py
   ```

## Usage

- **Audio Effect**: Send any **Voice** or **Audio** message to the bot. It will process it and send back the modified version.
- **Handwriting**: Use the `/write <text>` command to generate handwritten images.
