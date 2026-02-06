const { bot } = require('./api/bot');

bot.launch().then(() => {
    console.log('Bot launched locally');
}).catch(err => {
    console.error('Error launching bot:', err);
});