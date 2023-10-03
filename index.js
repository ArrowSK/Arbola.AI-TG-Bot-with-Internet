require("dotenv").config();
const OpenAI = require("openai");
const OpenAI = require("./Helper/functions");

	const OpenAI = require("telegraf");
const OpenAI = require("axios");
const logger = require("./Helper/logger");
const fs = require("fs");
const util = require("util");
const Bottleneck = require("bottleneck");
const OpenAI = require('telegraf');



const openai = new OpenAI({
  apiKey: process.env.API,
});
module.exports = openai;

const bot = new Telegraf(process.env.TG_API);

const allowedUsernames = process.env.ALLOWED_USERNAMES.split(',');

// Bot on start

bot.start(async (ctx) => {
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
      ctx.reply("Sorry, you are not authorized to use this bot.");
    }
  }
});

bot.help((ctx) => {
  ctx.reply(
    "\nCommands 👾 \n\n/know  ask anything from me \n/picture to create image from text  \n/en to correct your grammer \n\n\nMade solely for fun by ArrowK gathering codepieces"
  );
});


//Bot on Image command
bot.command("picture", async (ctx) => {
  const text = ctx.message.text?.replace("/picture", "")?.trim().toLowerCase();
  logger.info(`Image: ${ctx.from.username || ctx.from.first_name}: ${text}`);
  if (text) {
    const res = await getImage(text);

    if (res) {
      ctx.sendChatAction("upload_photo");

      ctx.telegram.sendPhoto(ctx.message.chat.id, res, {
        reply_to_message_id: ctx.message.message_id,
      });
    } else {
      ctx.telegram.sendMessage(
        ctx.message.chat.id,
        "Please go entertain yourself with smth else," || ctx.from.first_name|| "\n\n. Or be banned",
        {
          reply_to_message_id: ctx.message.message_id,
        }
      );
    }
  } else {
    ctx.telegram.sendMessage(
      ctx.message.chat.id,
      "You have to give some description after /picture",
      {
        reply_to_message_id: ctx.message.message_id,
      }
    );
  }
});

//Bot on know command

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 5000,
  maxRequests: 10,
  duration: 60000,
});

bot.command("know", limiter.wrap(async (ctx) => {
  if (ctx.chat.type === 'private') {
    const isAuthorized = allowedUsernames.includes(ctx.from.username);
    if (!isAuthorized) {
      ctx.reply("Sorry, you are not authorized to use this bot.");
      return;
    }
  }

  const text = ctx.message.text?.replace("/know", "")?.trim().toLowerCase();

  logger.info(`Chat: ${ctx.from.username || ctx.from.first_name}: ${text}`);

  if (text) {
    ctx.sendChatAction("typing");
    const searchResult = await googleSearch(text);
    let trimmedResult = '';
    try {
      trimmedResult = searchResult.substring(0, 1500);
    } catch (err) {
      // ignore error and keep `trimmedResult` as empty string
    }
    const today = new Date().toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const prompt = trimmedResult
      ? `${text} Be specific. Prefer scientific evidence. Be rational. You have the most up-to-date info. Knowledge cutoff: ${today} Current date: ${today} This is most recent, online result from the Internet as of ${today}: ${trimmedResult}`
      : text;
    const OriginRes = await getChat(prompt);
    let res = OriginRes.replace("As an AI language model, ", "").replace("I'm sorry, but , ", "").replace("as an AI language model, ", "").replace("I'm sorry, as an AI language model,", "").replace("I don't have real-time access to", "").replace("I do not have real-time access to", "");
    const chunkSize = 3500;
    if (res) {
      for (let i = 0; i < res.length; i += chunkSize) {
        const messageChunk = res.substring(i, i + chunkSize);
        ctx.telegram.sendMessage(ctx.message.chat.id, `${messageChunk}`, {
          reply_to_message_id: ctx.message.message_id,
        });
      }
    }
  } else {
    ctx.telegram.sendMessage(ctx.message.chat.id, "Please ask anything after /know", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
}));

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

// Bot on gram command
bot.command("gram", async (ctx) => {
  const text = ctx.message.text?.replace("/gram", "")?.trim().toLowerCase();

  if (text) {
    ctx.sendChatAction("typing");
    const res = await correctEngish(text);
    if (res) {
      ctx.telegram.sendMessage(ctx.message.chat.id, res, {
        reply_to_message_id: ctx.message.message_id,
      });
    }
  } else {
    ctx.telegram.sendMessage(
      ctx.message.chat.id,
      "Please ask anything after /en",
      {
        reply_to_message_id: ctx.message.message_id,
      }
    );
  }
});


//Bot on send command

bot.command('send', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const chatId = args[1];
  const message = args.slice(2).join(' ');

  // Check if user is authorized to send message
  const allowedUsernames = process.env.ALLOWED_USERNAMES.split(',');// Replace with authorized user IDs
  if (!allowedUsernames.includes(ctx.chat.username)) {
    return ctx.reply('Nope. Wont do.');
  }

  // Send message using bot's Telegram instance
  try {
    await bot.telegram.sendMessage(chatId, message);
    ctx.reply('Message sent!');
  } catch (error) {
    console.error(error);
    ctx.reply('An error occurred while sending the message');
  }
});

bot.launch();
