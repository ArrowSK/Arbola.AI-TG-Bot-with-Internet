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
const cron = require('node-cron');
const fs = require("fs");

const configuration = new Configuration({
  apiKey: process.env.API,
});

const openai = new OpenAIApi(configuration);
module.exports = openai;

const bot = new Telegraf(process.env.TG_API);

// Bot on start

bot.start(async (ctx) => {
  const allowedUsernames = ["artemskov", "OlgaVKov", "AndreKovalev", "ValeryEErg", "EvaCamomile", "antonsvens"];
  if (ctx.chat.type === "group") {
    logger.info(`Bot started In: ${ctx.chat.title} `);
  } else if (ctx.chat.type === "private") {
    if (allowedUsernames.includes(ctx.chat.username)) {
      logger.info(`Bot started By ${ctx.chat.username || ctx.chat.first_name}`);
      ctx.reply(
        "Welcome To AI Bot 🧿 \n\n I have the personality of an Oscar Wilde. Just talk with me! \n\n\nMade solely for fun by ArrowK gathering codepieces"
      );
    } else {
      logger.info(`Access denied to ${ctx.chat.username || ctx.chat.first_name}`);
      ctx.reply("Sorry, you are not authorized to use this bot.");
    }
  }
});

bot.help((ctx) => {
  ctx.reply(
    "\nCommands - none actually, just chat. \n\n\nMade solely for fun by ArrowK gathering codepieces"
  );
});

//Chat itself

const limiter = new Bottleneck({
  reservoir: 5,
  reservoirRefreshAmount: 5,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 1,
});

let mongoClient = null;

//MongoDB connection

async function connectToMongoDB() {
  if (!mongoClient) {
    try {
      mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
    } catch (err) {
      logger.error(err);
    }
  }
}

//MongoDB disconnection

async function closeMongoDBConnection() {
  if (mongoClient) {
    try {
      await mongoClient.close();
    } catch (err) {
      logger.error(err);
    } finally {
      mongoClient = null;
    }
  }
}

const prompts = new Map([
  ['wilde', 'You are an Oscar Wilde, British writer. Answer like he would.'],
  ['dawkins', 'Pretend you are Richard Dawkins. Answer like he would.'],
  ['friedman', 'You are Milton Friedman, an American libertarian economist. Answer like he would.'],
  ['slaanesh', 'You are Slaanesh, from Warhammer 40,000 universe. Answer like it would.'],
]);

let selectedPrompt = 'wilde';

bot.command('setprompt', (ctx) => {
  const userId = ctx.from.id;
  if (userId !== 760396488) {
    ctx.reply('Sorry, only the owner can change the prompt.');
    return;
  }
  const promptName = ctx.message.text.split(' ')[1];
  if (!prompts.has(promptName)) {
    ctx.reply(`Invalid prompt name. Available prompts are: ${Array.from(prompts.keys()).join(', ')}`);
    return;
  }
  selectedPrompt = promptName;
  ctx.reply(`Prompt set to: ${prompts.get(promptName)}`);
});

bot.on('message', async (ctx) => {
  if (ctx.chat.type === 'private') {
    const text = ctx.message.text?.trim().toLowerCase();
    logger.info(`Chat: ${ctx.from.username || ctx.from.first_name}: ${text}`);
    if (text && !text.startsWith('/')) {
      ctx.sendChatAction('typing');
      const chatId = ctx.message.chat.id;
      const messageCount = Math.min(ctx.message.message_id - 1, 15);
      await connectToMongoDB();
      const collection = mongoClient.db().collection('chat_history');
      const query = { chatId };
      const projection = { messages: { $slice: -messageCount } };
      const update = { $push: { messages: {
        text: ctx.message.text,
        from: ctx.message.from,
        message_id: ctx.message.message_id,
      } } };
      const options = { returnOriginal: false, upsert: true };
      let messageList = null;
      let closed = false;
      const timeout = setTimeout(() => {
        closeMongoDBConnection();
        closed = true;
      }, 5 * 60 * 1000);
      try {
        messageList = await collection.findOneAndUpdate(query, update, options, projection);
      } catch (err) {
        logger.error(err);
      } finally {
        clearTimeout(timeout);
        if (!closed) {
          closeMongoDBConnection();
        }
      }
      if (!messageList || !messageList.messages) {
        messageList = { messages: [] };
      }
      messageList = messageList.messages.reverse();
      const messages = [
        {
          role: 'system',
          content: prompts.get(selectedPrompt),
        },
        ...messageList.map((msg) => ({
          role: msg.from.id === ctx.botInfo.id ? 'assistant' : 'user',
          content: msg.text,
        })),
      ].reverse();
      const OriginRes = await limiter.schedule(() => getChat(text, messages));
      let res = OriginRes.replace('As an AI language model, ', '');
      const chunkSize = 3500;
      if (res) {
        for (let i = 0; i < res.length; i += chunkSize) {
          const messageChunk = res.substring(i, i + chunkSize);
          ctx.telegram.sendMessage(chatId, `${messageChunk}`);
        }
      }
	  
	  // Force the garbage collector to run
	  
	  res = null;
    } else {
      ctx.telegram.sendMessage(ctx.message.chat.id, "Please send me a message to start a conversation.");
    }
  }
});


//Daily DB cleanup

const uri = process.env.MONGODB_URI;
const options = { useNewUrlParser: true, useUnifiedTopology: true };

const cleanupDB = async () => {
  const client = await MongoClient.connect(uri, options);
  try {
    const db = client.db();
    const collection = db.collection('chat_history');
    const result = await collection.deleteMany({ createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    console.log(`Deleted ${result.deletedCount} documents from the database.`);
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
};

// Schedule a task to run every day at midnight CET (Central European Time)
cron.schedule('0 0 * * *', cleanupDB, {
  timezone: 'Europe/Paris'
});


bot.launch();
