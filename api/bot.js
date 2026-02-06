const { Telegraf } = require('telegraf')
const dotenv = require('dotenv')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { processAudio } = require('./audioProcessor')

dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables.')
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

bot.start(async ctx => {
    return ctx.reply(
        "Hi there! 🤖\n\n" +
        "I'm a *Voice Changer Bot*! Send me a voice message or audio file, and I'll transform it with a unique pitch shift effect.\n\n" +
        "Use /help to learn more!",
        {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message?.message_id,
            allow_sending_without_reply: true
        }
    )
})

bot.help((ctx) => {
    const helpMessage =
        "🤖 *Voice Changer Bot*\n\n" +
        "Send me a voice message or audio file and I'll apply a cool pitch shift effect to it!\n\n" +
        "The effect mixes the original audio with pitch-shifted versions (+4 and -3 semitones).";

    ctx.reply(helpMessage, { parse_mode: 'Markdown' });
})

// Handle voice messages
bot.on('voice', async (ctx) => {
    try {
        await ctx.reply('Processing your voice message... ⏳');
        
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        
        // Download to temp directory
        const inputPath = path.join(os.tmpdir(), `input_${Date.now()}.ogg`);
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(inputPath, Buffer.from(buffer));
        
        // Process audio
        const result = await processAudio(inputPath, 'voice.ogg');
        
        // Send processed audio back
        await ctx.replyWithAudio({ source: result.outputPath }, {
            caption: '✨ Processed voice with pitch shift effect!'
        });
        
        // Cleanup
        fs.unlinkSync(inputPath);
        fs.unlinkSync(result.outputPath);
        
    } catch (error) {
        console.error('Error processing voice:', error);
        await ctx.reply('Sorry, there was an error processing your voice message. 😔');
    }
});

// Handle audio files
bot.on('audio', async (ctx) => {
    try {
        await ctx.reply('Processing your audio file... ⏳');
        
        const fileId = ctx.message.audio.file_id;
        const fileName = ctx.message.audio.file_name || 'audio.mp3';
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        
        // Download to temp directory
        const inputPath = path.join(os.tmpdir(), `input_${Date.now()}${path.extname(fileName)}`);
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(inputPath, Buffer.from(buffer));
        
        // Process audio
        const result = await processAudio(inputPath, fileName);
        
        // Send processed audio back
        await ctx.replyWithAudio({ source: result.outputPath }, {
            caption: '✨ Processed with pitch shift effect!',
            filename: result.outputName
        });
        
        // Cleanup
        fs.unlinkSync(inputPath);
        fs.unlinkSync(result.outputPath);
        
    } catch (error) {
        console.error('Error processing audio:', error);
        await ctx.reply('Sorry, there was an error processing your audio file. 😔');
    }
});

// Graceful stops
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

console.log('Bot is initialized')

const handler = async (req, res) => {
    try {
        if (req.method === 'GET') {
            return res.status(200).send('Bot is running!')
        }

        // Vercel parses the body automatically if it's JSON
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (e) {
        console.error("Error in handler:", e);
        res.status(500).send('Error processing update');
    }
};

module.exports = handler;
module.exports.bot = bot;
