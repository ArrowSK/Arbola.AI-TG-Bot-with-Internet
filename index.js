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
const speech = require("@google-cloud/speech");
const fs = require("fs");
const util = require("util");
const Bottleneck = require("bottleneck");
const cheerio = require('cheerio');
const { Markup } = require('telegraf');

const configuration = new Configuration({
  apiKey: process.env.API,
});

const openai = new OpenAIApi(configuration);
module.exports = openai;

const bot = new Telegraf(process.env.TG_API);

// Bot on start

bot.start(async (ctx) => {
  const allowedUsernames = ["artemskov", "OlgaVKov", "AndreKovalev", "ValeryEErg"];
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
  minTime: 12000,
});

bot.command("know", limiter.wrap(async (ctx) => {
  const text = ctx.message.text?.replace("/know", "")?.trim().toLowerCase();

  logger.info(`Chat: ${ctx.from.username || ctx.from.first_name}: ${text}`);

  if (text) {
    ctx.sendChatAction("typing");
    const searchResult = await googleSearch(text);
    const trimmedResult = searchResult.substring(0, 1500);
    const prompt = trimmedResult
      ? `${text} Be specific. Do not repeat the prompt. Prefer scientific evidence. Be rational. Bear sexuality in mind. This is current info from the internet, you can use it but do not repeat: ${trimmedResult}`
      : text;
    const res = await getChat(prompt);
    const trimres = res.substring(0, 3900);
    if (trimres) {
      ctx.telegram.sendMessage(ctx.message.chat.id, `${trimres}`, {
        reply_to_message_id: ctx.message.message_id,
      });
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
  const allowedUsernames = ["artemskov", "OlgaVKov", "AndreKovalev"]; // Replace with authorized user IDs
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

//Bot on talk command


async function generateInsult() {
  const url = "https://sweary.com/";
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const insult = $("#words").text().trim();
  return insult;
}

bot.command("talk", async (ctx) => {
  const insult = await generateInsult();
  ctx.reply(insult);
});


//Bot on transcribe command

// Create a Speech-to-Text client with your Google Cloud credentials
const client = new speech.SpeechClient({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_API_KEY.replace(/\\n/g, '\n'),
  },
});

// Define the Telegram bot command to transcribe audio messages
bot.on('message', async (ctx) => {
  const chatId = ctx.chat.id;

  // Check if the message contains an audio file
  if (ctx.message.voice) {
    try {
      const voiceFile = await ctx.telegram.getFile(ctx.message.voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TG_API}/${voiceFile.file_path}`;
      const response1 = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(response1.data);
	  
      // Generate a unique file name for the audio message
      const fileName = `voice/${ctx.message.voice.file_unique_id}.${detectAudioFormat(fileBuffer)}`;

      // Save the audio file to disk
      fs.writeFileSync(fileName, fileBuffer);

      // Detect the audio language
      const languageCode = await detectAudioLanguage(fileBuffer);

      // Transcribe the audio file with Speech-to-Text API
      const audioFilePath = `./${fileName}`;
      const config = {
        encoding: detectAudioFormat(fileBuffer),
        languageCode: languageCode,
      };
      const request = {
        audio: {
          content: fs.readFileSync(audioFilePath).toString('base64')
        },
        config: config,
      };
      const [response2] = await client.recognize(request);
      const transcription = response2.results
        .map((result) => result.alternatives[0].transcript)
        .join('\n');

      // Send the transcription back to the user
      ctx.reply(transcription);
	  fs.unlink(fileName, (err) => {
	    if (err) {
	      console.error(err);
	      return;
	    }
	    console.log('Audio file deleted.');
	  });
    } catch (err) {
      console.error(err);
      ctx.reply('An error occurred while transcribing the audio message.');
    }
  }
});


// Function to detect the audio file format
function detectAudioFormat(audioBuffer) {
  const fileSignature = audioBuffer.toString('hex', 0, 4);
  switch (fileSignature) {
    case '52494646': // WAV file format
      return 'LINEAR16';
    case '464f524d': // OGG file format
      return 'OGG_OPUS';
    default:
      throw new Error('Unsupported audio file format.');
  }
}

// Function to detect the audio language
async function detectAudioLanguage(audioBuffer) {
  const [result] = await client.recognize({
    audio: {
      content: audioBuffer.toString('base64'),
    },
    config: {
      encoding: 'FLAC',
      sampleRateHertz: 16000,
      enableAutomaticLanguageDetection: true,
    },
  });
  return result.languageCode;
}


bot.command("yo", async (ctx) => {
  const text = ctx.message.text?.replace("/yo", "")?.trim().toLowerCase();
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
