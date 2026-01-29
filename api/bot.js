const { Telegraf } = require('telegraf')
const dotenv = require('dotenv')

dotenv.config()
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

bot.start(async ctx => {
    return ctx.reply(
        "Hi there! 🤖\n\n",
        {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message?.message_id,
            allow_sending_without_reply: true
        }
    )
})

bot.help((ctx) => {
    const helpMessage =
        "🤖";

    ctx.reply(helpMessage, { parse_mode: 'Markdown' });
})

// Graceful stops
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

console.log('Bot is running')

module.exports = async (req, res) => {
    try {
        // Vercel parses the body automatically if it's JSON
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (e) {
        console.error("Error in handler:", e);
        res.status(500).send('Error processing update');
    }
};
