require("dotenv").config();
const OpenAI = require("openai");
const getChat = require('./Helper/functions');
const { Telegraf } = require("telegraf"); // Import Telegraf from the telegraf library
const { MongoClient } = require('mongodb'); // Import MongoClient from the mongodb library
const Bottleneck = require("bottleneck");
const cron = require('node-cron');
const axios = require("axios"); // Import axios for HTTP requests
const logger = require("./Helper/logger");
const fs = require("fs");

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

// Bot on start

bot.start(async (ctx) => {
  if (ctx.chat.type === "group") {
    logger.info(`Bot started In: ${ctx.chat.title} `);
  } else if (ctx.chat.type === "private") {
    if (allowedUsernames.includes(ctx.chat.username)) {
      logger.info(`Bot started By ${ctx.chat.username || ctx.chat.first_name}`);
      ctx.reply(
        "Welcome To AI Bot 🧿 \n\n Just talk with me! \n\n\nMade solely for fun by ArrowK gathering codepieces"
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

const auto_usernames = process.env.AUTO_TELEGRAM_USERNAMES.split(","); // Get the usernames from .env file as a comma-separated string

// Schedule the prompt to be sent at 13:49 CET each day to all usernames
cron.schedule('49 13 * * *', async () => {
  const prompt = "Ask me a random question";

  for (const auto_username of auto_usernames) {
    try {
      const chat = await bot.telegram.getChat(auto_username);
      const chatId = chat.id;
      const response = await getChat(prompt, []);
      await bot.telegram.sendMessage(chatId, response);
    } catch (err) {
      console.error(`Error sending prompt to username ${username}: ${err}`);
    }
  }
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

    // Check if user is authorized
    if (!allowedUsernames.includes(ctx.from.username)) {
      ctx.telegram.sendMessage(ctx.message.chat.id, "You are not authorized to use this bot.");
      return;
    }

    if (text && !text.startsWith('/')) {
      ctx.sendChatAction('typing');
      const chatId = ctx.message.chat.id;
      const messageCount = Math.min(ctx.message.message_id - 1, 15);

      await connectToMongoDB();
      const collection = mongoClient.db().collection('chat_history');
      const query = { chatId };
      const projection = { messages: { $slice: -messageCount } };
      const update = {
        $push: {
          messages: {
            text: ctx.message.text,
            from: ctx.message.from,
            message_id: ctx.message.message_id,
          },
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
        // ignore error and keep `trimmedResult` as empty string
      }

      const promptWithResult = trimmedResult
        ? `This is the most recent online result from the Internet as of ${today}: ${trimmedResult}`
        : '';

		const messages = [
		  {
		    role: 'system',
		    content: prompts.get(selectedPrompt) + promptWithResult,
		  },
		  ...messageList.map((msg) => ({
		    role: msg.from.id === ctx.botInfo.id ? 'assistant' : 'user',
		    content: msg.text,
		  })),
		];

		const OriginRes = await limiter.schedule(() => getChat(text, messages));
		let res = OriginRes.replace("As an AI language model, ", "").replace("I'm sorry, I cannot provide real-time information as I am an AI language model and do not have access to live data.", "").replace("I'm sorry, but I don't have access to real-time data. However, ", "").replace("I'm sorry, but I don't have access to real-time data.", "").replace("I'm sorry, I cannot provide real-time information as my responses are based on pre-existing data. However, ", "").replace("I'm sorry, I cannot provide real-time information as my responses are based on pre-existing data.", "").replace("I'm sorry, but , ", "").replace("as an AI language model, ", "").replace("I'm sorry, as an AI language model,", "").replace("I don't have real-time access to", "").replace("I do not have real-time access to", "");

		const chunkSize = 3500;
		if (res) {
		  messages.push({
		    role: 'assistant',
		    content: res, // The bot's response
		  });

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


// Function to perform a Google search

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
