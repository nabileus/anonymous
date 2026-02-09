const { Bot, InputFile } = require('grammy');
const { generatePages } = require('./imageProcessor');
const { processAudio } = require('./audioProcessor');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is unset');

const bot = new Bot(token);
const CHANNEL_ID = process.env.CHANNEL_ID;

// --- Image Processing Command ---
bot.command('write', async (ctx) => {
    const text = ctx.message.text.split(/\s+(.+)/)[1]; // Split by first whitespace
    if (!text) return ctx.reply('Provide text.');

    try {
        const buffers = await generatePages(text);

        const mediaGroup = buffers.map((buf, index) => {
            return {
                type: 'photo',
                media: new InputFile(buf),
                caption: index === 0 ? `Thanks ${ctx.from.first_name}` : undefined
            };
        });

        await ctx.replyWithMediaGroup(mediaGroup);

        if (CHANNEL_ID) {
            const userCaption = `${ctx.from.first_name} - @${ctx.from.username || 'unknown'}`;
            const channelMediaGroup = buffers.map((buf, index) => {
                return {
                    type: 'photo',
                    media: new InputFile(buf),
                    caption: index === 0 ? userCaption : undefined
                };
            });
            await ctx.api.sendMediaGroup(CHANNEL_ID, channelMediaGroup);
        }

    } catch (error) {
        console.error('Image Error:', error);
        await ctx.reply('Failed to generate image.');
    }
});

// --- Audio Processing ---
bot.on(['message:voice', 'message:audio'], async (ctx) => {
    const startTime = Date.now();
    const file = ctx.message.voice || ctx.message.audio;
    if (!file) return;

    try {
        const fileInfo = await ctx.api.getFile(file.file_id);
        // Constructed URL might be brittle if API changes, but standard for now.
        // Grammy has `fileInfo.getUrl()`? No, need to construct or use `ctx.api.raw`. 
        // `https://api.telegram.org/file/bot<token>/<file_path>`
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

        await ctx.replyWithAudio(new InputFile(outputPath), {
            caption: `Thanks ${user.first_name}. ${timeCaption}`,
            title: outputName
        });

        if (CHANNEL_ID) {
            await ctx.api.sendAudio(CHANNEL_ID, new InputFile(outputPath), {
                caption: `${baseCaption}${timeCaption}`,
                title: outputName
            });

            await ctx.api.sendAudio(CHANNEL_ID, new InputFile(tempInput), {
                caption: baseCaption,
                title: originalName
            });
        }

        // Cleanup (async without await to return faster? No, better cleanup)
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

module.exports = bot;
