require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const {
  getImage,
  getChat,

  correctEngish,
} = require("./Helper/functions");

const { Telegraf } = require("telegraf");
const { default: axios } = require("axios");
const logger = require("./Helper/logger");


const configuration = new Configuration({
  apiKey: process.env.API,
});

const openai = new OpenAIApi(configuration);
module.exports = openai;

const bot = new Telegraf(process.env.TG_API);


// Bot on start

bot.start(async (ctx) => {
  const allowedUsernames = ["artemskov", "OlgaVKov", "AndreKovalev"];
  if (ctx.chat.type === "group") {
    logger.info(`Bot started In: ${ctx.chat.title} `);
  } else if (ctx.chat.type === "private") {
    if (allowedUsernames.includes(ctx.chat.username)) {
      logger.info(`Bot started By ${ctx.chat.username || ctx.chat.first_name}`);
      ctx.reply(
        "Welcome To AI Bot 🧿 \n\nCommands 👾 \n/ask  ask anything from me \n/image to create image from text  \n/en to correct your grammer \n\n\nMade solely for fun by ArrowK gathering codepieces"
      );
    } else {
      logger.info(`Access denied to ${ctx.chat.username || ctx.chat.first_name}`);
    }
  }
});

bot.help((ctx) => {
  ctx.reply(
    "\nCommands 👾 \n\n/ask  ask anything from me \n/image to create image from text  \n/en to correct your grammer \n\n\nMade solely for fun by ArrowK gathering codepieces"
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
      "You have to give some description after /image",
      {
        reply_to_message_id: ctx.message.message_id,
      }
    );
  }
});

//Bot on know command

const Bottleneck = require('bottleneck');
const limiter = new Bottleneck({
  reservoir: 10,
  reservoirRefreshAmount: 10,
  reservoirRefreshInterval: 60 * 1000,
});

bot.on('message', async (ctx) => {
  const replyMessage = ctx.message.reply_to_message;
  if (replyMessage && replyMessage.from.id === bot.botInfo.id) {
    const text = ctx.message.text?.trim().toLowerCase();
    
    ctx.sendChatAction("typing");

    logger.info(`Chat: ${ctx.from.username || ctx.from.first_name}: ${text}`);

    try {
      const res = await limiter.schedule(() => getChat(text));
      if (res) {
        ctx.telegram.sendMessage(
          ctx.message.chat.id,
          `${res}`,
          {
            reply_to_message_id: replyMessage.message_id,
          }
        );
      }
    } catch (err) {
      if (err instanceof Bottleneck.BottleneckError) {
        ctx.reply("Sorry, I'm too tired. Please let me rest for a while...");
      } else {
        logger.error(`Error: ${err}`);
        ctx.reply("Sorry, something went wrong. Please try again later.");
      }
    }
  }
});

bot.command("know", async (ctx) => {
  const text = ctx.message.text?.replace("/know", "")?.trim().toLowerCase();
  
  ctx.sendChatAction("typing");

  logger.info(`Chat: ${ctx.from.username || ctx.from.first_name}: ${text}`);

  if (text) {
    try {
      const res = await limiter.schedule(() => getChat(text));
      if (res) {
        ctx.telegram.sendMessage(
          ctx.message.chat.id,
          `${res}`,
          {
            reply_to_message_id: ctx.message.message_id,
          }
        );
      }
    } catch (err) {
      if (err instanceof Bottleneck.BottleneckError) {
        ctx.reply("Sorry, I'm too tired. Please let me rest for a while...");
      } else {
        logger.error(`Error: ${err}`);
        ctx.reply("Sorry, something went wrong. Please try again later.");
      }
    }
  } else {
    ctx.telegram.sendMessage(
      ctx.message.chat.id,
      "Please ask anything after /know",
      {
        reply_to_message_id: ctx.message.message_id,
      }
    );
  }
});

// Bot on en command
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

bot.command("yos", async (ctx) => {
  const text = ctx.message.text?.replace("/yos", "")?.trim().toLowerCase();
  logger.info(`Joke: ${ctx.from.username || ctx.from.first_name}: ${text}`);

  const ress = await axios.get("https://api.yomomma.info/");

  ctx.sendChatAction("typing");

  if (ress.data?.joke) {
    ctx.telegram.sendMessage(ctx.message.chat.id, ress.data?.joke, {
      reply_to_message_id: ctx.message.message_id,
    });
  }
});

bot.launch();
