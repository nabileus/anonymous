const { webhookCallback } = require('grammy');
const bot = require('../lib/bot');

module.exports = webhookCallback(bot, 'http');
