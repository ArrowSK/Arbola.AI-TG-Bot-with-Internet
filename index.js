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

const ffmpeg = require('fluent-ffmpeg');

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
      if (!fs.existsSync('voice')) {
        fs.mkdirSync('voice');
      }
      fs.writeFileSync(fileName, fileBuffer);

      // Check if the audio format is supported by the Google Speech-to-Text API
      const supportedAudioFormats = ['FLAC', 'LINEAR16', 'MULAW', 'AMR', 'AMR_WB', 'OGG_OPUS', 'SPEEX_WITH_HEADER_BYTE'];
      const audioFormat = detectAudioFormat(fileBuffer);
      if (!supportedAudioFormats.includes(audioFormat)) {
        console.log(`Converting ${audioFormat} to FLAC for Google Speech-to-Text API compatibility...`);
        const convertedFileName = `voice/${ctx.message.voice.file_unique_id}.flac`;
        await convertAudioFile(fileName, convertedFileName);
        fs.unlinkSync(fileName);
        fileName = convertedFileName;
      }

      // Detect the audio language
      const languageCode = await detectAudioLanguage(fileBuffer);

      // Transcribe the audio file with Speech-to-Text API
      const audioFilePath = `./${fileName}`;
      const config = {
        encoding: detectAudioFormat(fs.readFileSync(audioFilePath)),
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

// Function to check the format of an audio file buffer
function detectAudioFormat(buffer) {
   // Check for the "RIFF" identifier at the beginning of the buffer
    if (buffer.toString('ascii', 0, 4) === 'RIFF') {
      // Check for the "WAVE" identifier at byte 8 of the buffer
      if (buffer.toString('ascii', 8, 12) === 'WAVE') {
        // Check for the "fmt " sub-chunk identifier at byte 12 of the buffer
        if (buffer.toString('ascii', 12, 16) === 'fmt ') {
          // Check for the PCM audio format (audio format code 1) at byte 20 of the buffer
          if (buffer.readUInt16LE(20) === 1) {
            // Check for the number of channels (mono or stereo) at byte 22 of the buffer
            const numChannels = buffer.readUInt16LE(22);
            if (numChannels === 1) {
              return 'pcm_s16le';
            } else if (numChannels === 2) {
              return 'pcm_s16le';
            }
          }
        }
      }
    }
  
    // If the format is not supported, convert it to a supported format using ffmpeg
    return convertToSupportedFormat(buffer);
  }

  // Function to convert an audio file buffer to a supported format using ffmpeg
  async function convertToSupportedFormat(buffer) {
    // Create a temporary file to store the original audio buffer
    const inputFile = `./temp/original.${detectAudioFormat(buffer)}`;
    fs.writeFileSync(inputFile, buffer);

    // Create a temporary file to store the converted audio buffer
    const outputFile = `./temp/converted.${SUPPORTED_AUDIO_FORMAT}`;
  
    // Convert the original audio file to the supported format using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .output(outputFile)
        .on('end', () => {
          console.log(`Audio file converted to ${SUPPORTED_AUDIO_FORMAT}.`);
          resolve();
        })
        .on('error', (err) => {
          console.error(err);
          reject(err);
        })
        .run();
    });

    // Read the converted audio file into a buffer
    const convertedBuffer = fs.readFileSync(outputFile);

    // Delete the temporary files
    fs.unlinkSync(inputFile);
    fs.unlinkSync(outputFile);

    return SUPPORTED_AUDIO_FORMAT;
  }

// Function to detect the audio file format

function detectAudioFormat(audioBuffer) {
  const fileSignature = audioBuffer.toString('hex', 0, 4);
  switch (fileSignature) {
    case '52494646': // WAV file format
      return 'LINEAR16';
    case '464f524d': // OGG file format
      return 'OGG_OPUS';
    case 'fff15080': // MP3 file format
      return 'MP3';
    case '3026b275': // AMR-WB file format
      return 'AMR_WB';
    case '23e29e00': // Opus file format
      return 'OPUS';
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
