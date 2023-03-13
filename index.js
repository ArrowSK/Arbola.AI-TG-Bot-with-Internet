require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const {
  getImage,
  getChat,

  correctEngish,
} = require("./Helper/functions");

const { Telegraf, Telegram, Extra, Markup, session } = require("telegraf");
const { default: axios } = require("axios");
const logger = require("./Helper/logger");
const fs = require("fs");
const util = require("util");
const Bottleneck = require("bottleneck");
const Redis = require("ioredis");
const redisClient = new Redis(process.env.REDIS_DT);


const configuration = new Configuration({
  apiKey: process.env.API,
});

const openai = new OpenAIApi(configuration);
module.exports = openai;

const bot = new Telegraf(process.env.TG_API);

// Bot on start

bot.start(async (ctx) => {
  const allowedUsernames = ["artemskov", "OlgaVKov", "AndreKovalev", "ValeryEErg", "EvaCamomile"];
  if (ctx.chat.type === "group") {
    logger.info(`Bot started In: ${ctx.chat.title} `);
  } else if (ctx.chat.type === "private") {
    if (allowedUsernames.includes(ctx.chat.username)) {
      logger.info(`Bot started By ${ctx.chat.username || ctx.chat.first_name}`);
      ctx.reply(
        "Welcome To AI Bot 🧿 \n\nCommands 👾 \n\n/know  ask anything from me \n/picture to create image from text  \n/en to correct your grammer \n\n\nMade solely for fun by ArrowK gathering codepieces"
      );
    } else {
      logger.info(`Access denied to ${ctx.chat.username || ctx.chat.first_name}`);
    }
  }
});

bot.help((ctx) => {
  ctx.reply(
    "\nCommands - none actually, just chat. \n\n\nMade solely for fun by ArrowK gathering codepieces"
  );
});

const limiter = new Bottleneck({
  reservoir: 5,
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
});

bot.on("message", async (ctx) => {
  if (ctx.chat.type === "private") {
    const text = ctx.message.text?.trim().toLowerCase();
    logger.info(`Chat: ${ctx.from.username || ctx.from.first_name}: ${text}`);
    if (text && !text.startsWith('/')) {
      ctx.sendChatAction("typing");
      const chatId = ctx.message.chat.id;
      const messageCount = Math.min(ctx.message.message_id - 1, 10);
      const redisKey = `chat_history_${chatId}`;
	  let messageList = await redisClient.lrange(redisKey, 0, messageCount - 1);
	  messageList = messageList.map(msg => JSON.parse(msg));
      const messages = messageList.map(msg => ({
        role: msg.from.id === ctx.botInfo.id ? "assistant" : "user",
        content: msg.text
      })).reverse();
      const OriginRes = await limiter.schedule(() => getChat(text, messages));
      const res = OriginRes.replace("As an AI language model, ", "");
      const chunkSize = 3500;
      if (res) {
        for (let i = 0; i < res.length; i += chunkSize) {
          const messageChunk = res.substring(i, i + chunkSize);
          ctx.telegram.sendMessage(chatId, `${messageChunk}`);
        }
      }
	  await redisClient.rpush(redisKey, JSON.stringify({
text: ctx.message.text,
from: ctx.message.from,
message_id: ctx.message.message_id,
	  }));
    } else {
      ctx.telegram.sendMessage(ctx.message.chat.id, "Please send me a message to start a conversation.");
    }
  }
});

//Clean DB daily

const cron = require('node-cron');
const { promisify } = require('util');

// Schedule a task to run every day at midnight CET (Central European Time)
cron.schedule('0 0 * * *', async () => {
  // Get current UTC date and time
  const now = new Date();

  // Set timezone to CET
  now.setUTCHours(now.getUTCHours() + 1);

  // Set time to midnight CET
  now.setUTCHours(0, 0, 0, 0);

  // Convert date and time to timestamp in milliseconds
  const timestamp = now.getTime();

  // Get Redis client
  const redisClient = getRedisClient();

  // Delete all Redis keys that are older than 24 hours
  const deleteAsync = promisify(redisClient.del).bind(redisClient);
  await deleteAsync(redisClient.keys('*').filter(key => key.endsWith('_history') && key.startsWith('chat_history_') && Number(key.split('_').pop()) < timestamp));
}, {
  scheduled: true,
  timezone: 'Europe/Paris',
});

bot.launch();
