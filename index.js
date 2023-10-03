require("dotenv").config();
const OpenAI = require("openai");
const { getChat } = require('./Helper/functions');
const { Telegraf } = require("telegraf");
const { MongoClient } = require('mongodb');

const cron = require('node-cron');
const axios = require("axios");
const logger = require("./Helper/logger");

const openai = new OpenAI({
  apiKey: process.env.API,
});
module.exports = openai;

const bot = new Telegraf(process.env.TG_API);

const allowedUsernames = process.env.ALLOWED_USERNAMES.split(',');

const today = new Date().toLocaleDateString("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

let mongoClient = null;

async function connectToMongoDB() {
  if (!mongoClient) {
    try {
      mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
    } catch (err) {
      logger.error(err);
    }
  }
}

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
  ['polymath', process.env.PROMPT_POLYMATH],
  ['all-known', process.env.PROMPT_ALL_KNOWN],
]);

let selectedPrompt = 'polymath';

bot.command('setprompt', (ctx) => {
  const userId = Number(process.env.BOT_OWNER_USER_ID);
  if (ctx.from.id !== userId) {
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

    if (!allowedUsernames.includes(ctx.from.username)) {
      ctx.telegram.sendMessage(ctx.message.chat.id, "You are not authorized to use this bot.");
      return;
    }

    if (text && !text.startsWith('/')) {
      ctx.sendChatAction('typing');
      const chatId = ctx.message.chat.id;
      const messageCount = Math.min(ctx.message.message_id - 1, 10);

      await connectToMongoDB();
      const collection = mongoClient.db().collection('chat_history');
      const query = { chatId };
      const projection = { messages: { $slice: -messageCount } };

      // Define OriginRes and res
      let OriginRes = '';
      let res = '';

      try {
        const messages = []; // Define messages here

        OriginRes = await getChat(text, messages);
        res = OriginRes.replace("As an AI language model, ", "").replace("I'm sorry, I cannot provide real-time information as I am an AI language model and do not have access to live data.", "").replace("I'm sorry, but I don't have access to real-time data. However, ", "").replace("I'm sorry, but I don't have access to real-time data.", "").replace("I'm sorry, I cannot provide real-time information as my responses are based on pre-existing data. However, ", "").replace("I'm sorry, I cannot provide real-time information as my responses are based on pre-existing data.", "").replace("I'm sorry, but , ", "").replace("as an AI language model, ", "").replace("I'm sorry, as an AI language model,", "").replace("I don't have real-time access to", "").replace("I do not have real-time access to", "");
        
        const update = {
          $push: {
            messages: [
              {
                text: ctx.message.text,
                from: ctx.message.from,
                message_id: ctx.message.message_id,
                role: 'user',
              },
              {
                text: res,
                from: ctx.botInfo,
                role: 'assistant',
              },
            ],
          },
        };
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

        const searchResult = await googleSearch(text);
        let trimmedResult = '';
        try {
          trimmedResult = searchResult.substring(0, 3000);
        } catch (err) {
          // ignore error and keep `trimmedResult` as an empty string
        }

        const promptWithResult = trimmedResult
          ? `This is the most recent online result from the Internet as of ${today}: ${trimmedResult}`
          : '';

        const messagesToSend = [
          {
            role: 'system',
            content: prompts.get(selectedPrompt) + promptWithResult,
          },
          {
            role: 'user',
            content: text,
          },
          ...messageList.map((msg) => ({
            role: msg.from.id === ctx.botInfo.id ? 'assistant' : 'user',
            content: msg.text,
          })),
          {
            role: 'assistant',
            content: res,
          },
        ];

        const chunkSize = 3500;
        if (res) {
          messagesToSend.push({
            role: 'assistant',
            content: res,
          });

          for (let i = 0; i < res.length; i += chunkSize) {
            const messageChunk = res.substring(i, i + chunkSize);
            ctx.telegram.sendMessage(chatId, `${messageChunk}`);
          }
        }

        res = null; // Clear res after sending

      } catch (error) {
        logger.error(error);
      }
    } else {
      ctx.telegram.sendMessage(ctx.message.chat.id, "Please send me a message to start a conversation.");
    }
  }
});

async function googleSearch(query) {
  const cx = process.env.CUSTOM_SEARCH_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&num=1&cr=countryUK&uomSystem=metric`;

  try {
    const response = await axios.get(url);
    if (response.data.items && response.data.items[0]) {
      return response.data.items[0].snippet;
    }
  } catch (error) {
    console.error(error);
  }
}

const { clearConversationHistory } = require('./Helper/functions');

bot.command('clearhistory', async (ctx) => {
  if (ctx.chat.type === 'private') {
    const chatId = ctx.message.chat.id;

    const cleared = await clearConversationHistory(chatId);

    if (cleared) {
      ctx.reply('Conversation history cleared successfully.');
    } else {
      ctx.reply('No conversation history found to clear.');
    }
  }
});

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

cron.schedule('0 0 * * *', cleanupDB, {
  timezone: 'Europe/Paris'
});

bot.launch();
