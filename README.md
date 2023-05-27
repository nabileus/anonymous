# anonymous
# Telegram Bot

This is a Telegram bot that performs various functions:

1. Audio Processing:
   - Accepts voice or audio files from users
   - Applies pitch shifting and time stretching effects
   - Sends the processed audio back to the user and a specified channel

2. Image Generation:
   - Accepts text input from users using the '/write' command
   - Generates an image based on the input text
   - Sends the generated image back to the user and a specified channel

## Setup

1. Clone the repository:

```shell
git clone https://github.com/nabileus/anonymous
```

2.Install the required Python packages:
```shell
    pip install -r requirements.txt
```
3.Replace 'YOUR_TELEGRAM_BOT_TOKEN' in the code with your actual bot token.
4.Replace 'YOUR_CHANNEL_ID' in the code with the ID of the channel where you want to send the files.
5.Run the bot:
```shell
    python bot.py
```
    
Usage
The bot responds to the following commands:

'/start': Welcomes the user to the bot.
'/write <text>': Generates an image based on the provided text.
When an audio file or text is sent to the bot, it processes the audio or generates an image accordingly.
