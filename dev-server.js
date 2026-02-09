const bot = require('./lib/bot');

console.log('Starting Development Server (Polling Mode)...');

// Handle errors
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    console.error(e);
});

bot.start();
