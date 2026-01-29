const { Telegraf } = require('telegraf');
const { Input } = require('telegraf');
const { generatePages } = require('../lib/imageProcessor');
const { processAudio } = require('../lib/audioProcessor');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is unset');

const bot = new Telegraf(token);
const CHANNEL_ID = process.env.CHANNEL_ID;

// --- Image Processing Command ---
bot.command('write', async (ctx) => {
    const text = ctx.message.text.split(/\s+(.+)/)[1];
    if (!text) return ctx.reply('Provide text.');

    try {
        const buffers = await generatePages(text);

        const mediaGroup = buffers.map((buf, index) => ({
            type: 'photo',
            media: { source: buf },
            caption: index === 0 ? `Thanks ${ctx.from.first_name}` : undefined
        }));

        await ctx.replyWithMediaGroup(mediaGroup);

        if (CHANNEL_ID) {
            const userCaption = `${ctx.from.first_name} - @${ctx.from.username || 'unknown'}`;
            const channelMediaGroup = buffers.map((buf, index) => ({
                type: 'photo',
                media: { source: buf },
                caption: index === 0 ? userCaption : undefined
            }));
            await ctx.telegram.sendMediaGroup(CHANNEL_ID, channelMediaGroup);
        }

    } catch (error) {
        console.error('Image Error:', error);
        await ctx.reply('Failed to generate image.');
    }
});

// --- Audio Processing ---
bot.on(['voice', 'audio'], async (ctx) => {
    const startTime = Date.now();
    const file = ctx.message.voice || ctx.message.audio;
    if (!file) return;

    try {
        const fileInfo = await ctx.telegram.getFile(file.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;

        const originalName = file.file_name || `audio_${file.file_unique_id}.ogg`;
        const tempInput = path.join(os.tmpdir(), originalName);

        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempInput);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const { outputPath, outputName } = await processAudio(tempInput, originalName);

        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

        const user = ctx.from;
        const baseCaption = `${user.first_name} - @${user.username || 'unknown'}`;
        const timeCaption = `\nTime took: ${timeTaken} seconds`;

        await ctx.replyWithAudio({ source: outputPath }, {
            caption: `Thanks ${user.first_name}. ${timeCaption}`,
            title: outputName
        });

        if (CHANNEL_ID) {
            await ctx.telegram.sendAudio(CHANNEL_ID, { source: outputPath }, {
                caption: `${baseCaption}${timeCaption}`,
                title: outputName
            });

            await ctx.telegram.sendAudio(CHANNEL_ID, { source: tempInput }, {
                caption: baseCaption,
                title: originalName
            });
        }

        try {
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {
            console.error('Cleanup error', e);
        }

    } catch (error) {
        console.error('Audio Error:', error);
        await ctx.reply('Processing failed.');
    }
});

bot.start(async ctx => {
    return ctx.reply(
        "Hi there! 🤖\n\nI can help you with:\n• `/write` - Generate images from text\n• Send voice/audio - Transform your voice",
        {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message?.message_id,
            allow_sending_without_reply: true
        }
    );
});

bot.help((ctx) => {
    const helpMessage = "📖 *Help*\n\n*Commands:*\n• `/write <text>` - Generate images from text\n• `/start` - Show welcome message\n\n*Features:*\n• Send voice or audio files to process them";
    ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

module.exports = async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (e) {
        console.error("Error in handler:", e);
        res.status(500).send('Error processing update');
    }
};
