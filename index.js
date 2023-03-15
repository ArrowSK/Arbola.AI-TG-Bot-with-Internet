require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const {
  getImage,
  getChat,
  correctEngish,
} = require("./Helper/functions");
const { Telegraf, Extra, Markup, session } = require("telegraf");
const { default: axios } = require("axios");
const logger = require("./Helper/logger");
const Bottleneck = require("bottleneck");
const { MongoClient } = require('mongodb');

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
      const mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
      const collection = mongoClient.db().collection('chat_history');
      let messageList = await collection.findOneAndUpdate(
        { chatId },
        { $push: { messages: {
            text: ctx.message.text,
            from: ctx.message.from,
            message_id: ctx.message.message_id,
          } } },
        { returnOriginal: false, upsert: true }
      );
      messageList = messageList.value.messages.slice(-messageCount).reverse();
      const messages = [
        {
          role: "system",
          content: "You are an Oscar Wilde, British writer. Please answer like he would.",
        },
        ...messageList.map((msg) => ({
          role: msg.from.id === ctx.botInfo.id ? "assistant" : "user",
          content: msg.text,
        })),
      ].reverse();
      const OriginRes = await limiter.schedule(() => getChat(text, messages));
      let res = OriginRes.replace("As an AI language model, ", "");
      const chunkSize = 3500;
      if (res) {
        for (let i = 0; i < res.length; i += chunkSize) {
          const messageChunk = res.substring(i, i + chunkSize);
          ctx.telegram.sendMessage(chatId, `${messageChunk}`);
        }
      }
	  
	  // Force the garbage collector to run
	  
	  res = null;
	  
      mongoClient.close();
    } else {
      ctx.telegram.sendMessage(ctx.message.chat.id, "Please send me a message to start a conversation.");
    }
  }
});

const cron = require('node-cron');

// MongoDB connection URI and options
const uri = process.env.MONGODB_URI;
const options = { useNewUrlParser: true, useUnifiedTopology: true };

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

  // Connect to MongoDB
  const client = await MongoClient.connect(uri, options);

  try {
    // Get a reference to the chat_history collection
    const collection = client.db().collection('chat_history');

    // Delete all documents that are older than 24 hours
    await collection.deleteMany({ 
      timestamp: { $lt: timestamp }, 
      key: /^chat_history_\d+$/,
    });
  } finally {
    // Close the MongoDB connection
    client.close();
  }
}, {
  scheduled: true,
  timezone: 'Europe/Paris',
});

bot.launch();
