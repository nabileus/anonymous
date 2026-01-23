import os
import gc
import io
import time
import telebot
import librosa
import soundfile as sf
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv
from telebot.types import InputMediaPhoto

# Load Configuration
load_dotenv()
bot = telebot.TeleBot(os.getenv('TELEGRAM_BOT_TOKEN'))
CHANNEL_ID = os.getenv('CHANNEL_ID')

# --- Audio Processing ---
@bot.message_handler(content_types=['voice', 'audio'])
def process_audio(message):
    # Start Timer
    start_time = time.time()

    # Initialize for cleanup
    y = None
    mixed = None
    file_data = None

    try:
        file_obj = message.voice if message.voice else message.audio
        if not file_obj: return

        # 1. Get File Info & Name
        file_info = bot.get_file(file_obj.file_id)
        original_name = file_info.file_path.split('/')[-1]
        # Create output name: "filename_filtered.wav"
        output_name = f"{os.path.splitext(original_name)[0]}_filtered.wav"

        # 2. Download & Load
        file_data = bot.download_file(file_info.file_path)
        y, sr = librosa.load(io.BytesIO(file_data), sr=None)

        # 3. Process
        mixed = y.copy()
        for steps in [4, -3]:
            mixed += librosa.effects.pitch_shift(y, sr=sr, n_steps=steps)

        # 4. Save to Buffer
        out_buffer = io.BytesIO()
        sf.write(out_buffer, mixed, sr, format='wav')
        out_buffer.seek(0)

        # IMPORTANT: Set the name attribute so Telegram sees the correct filename
        out_buffer.name = output_name

        # 5. Calculate Time
        time_taken = round(time.time() - start_time, 2)

        # 6. Send
        user = message.from_user
        base_caption = f"{user.first_name} - @{user.username}"
        time_caption = f"\nTime took: {time_taken} seconds"

        # Send to User
        bot.send_audio(
            message.chat.id,
            out_buffer,
            caption=f"Thanks {user.first_name}.{time_caption}"
        )

        # Rewind for Channel
        out_buffer.seek(0)
        bot.send_audio(
            CHANNEL_ID,
            out_buffer,
            caption=f"{base_caption}{time_caption}"
        )

        # Send Original to Channel
        original_buffer = io.BytesIO(file_data)
        original_buffer.name = original_name # Set original name
        bot.send_audio(CHANNEL_ID, original_buffer, caption=base_caption)

    except Exception as e:
        print(f"Audio Error: {e}")
        bot.send_message(message.chat.id, 'Processing failed.')

    finally:
        if y is not None: del y
        if mixed is not None: del mixed
        if file_data is not None: del file_data
        gc.collect()

# --- Image Processing (Same as before) ---
def generate_pages_in_memory(text):
    font = ImageFont.truetype("assfont.ttf", 30)
    bbox = font.getbbox("hg")
    line_height = (bbox[3] - bbox[1]) + 3

    with Image.open("template.jpg") as tpl:
        base_img = tpl.copy()
        width, height = tpl.size

    start_x, start_y = 150, 140
    max_width = width - start_x - 10
    max_y = height - (3 * line_height)

    lines = []
    space_w = font.getlength(" ")

    for paragraph in text.split('\n'):
        if font.getlength(paragraph) <= max_width:
            lines.append(paragraph)
        else:
            words = paragraph.split(' ')
            curr_line, curr_w = words[0], font.getlength(words[0])
            for word in words[1:]:
                word_w = font.getlength(word)
                if curr_w + space_w + word_w <= max_width:
                    curr_line += " " + word
                    curr_w += space_w + word_w
                else:
                    lines.append(curr_line)
                    curr_line, curr_w = word, word_w
            lines.append(curr_line)

    media_group = []
    curr_y = start_y
    canvas = base_img.copy()
    draw = ImageDraw.Draw(canvas)

    for line in lines:
        if curr_y + line_height > max_y:
            bio = io.BytesIO()
            canvas.save(bio, format='JPEG')
            bio.seek(0)
            media_group.append(InputMediaPhoto(bio))
            canvas = base_img.copy()
            draw = ImageDraw.Draw(canvas)
            curr_y = start_y

        draw.text((start_x, curr_y), line, fill=(1, 22, 55), font=font)
        curr_y += line_height

    bio = io.BytesIO()
    canvas.save(bio, format='JPEG')
    bio.seek(0)
    media_group.append(InputMediaPhoto(bio))
    return media_group

@bot.message_handler(commands=['write'])
def handle_write(message):
    parts = message.text.split(maxsplit=1)
    if len(parts) < 2: return bot.send_message(message.chat.id, "Provide text.")

    try:
        album = generate_pages_in_memory(parts[1])
        user = message.from_user

        album[0].caption = f"Thanks {user.first_name}"
        bot.send_media_group(message.chat.id, album)

        for photo in album: photo.media.seek(0)

        album[0].caption = f"{user.first_name} - @{user.username}"
        bot.send_media_group(CHANNEL_ID, album)

    except Exception as e:
        print(f"Image Error: {e}")
        bot.send_message(message.chat.id, "Failed.")
    finally:
        gc.collect()

bot.polling()
