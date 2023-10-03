const OpenAI = require("openai");
const logger = require("./logger");
const { MongoClient } = require('mongodb');


const openai = new OpenAI({
  apiKey: process.env.API,
});

// Generate answer from prompt

const getChat = async (text, messages) => {
  try {
    const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo-16k",
      messages: [...messages, { role: "user", content: text }],
      temperature: 0.3,
  max_tokens: 900,
  top_p: 1,
  frequency_penalty: 0.2,
  presence_penalty: 0.05,
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.log(error);
    logger.error("Error while generating Answer");
  }
};

// Function to perform a Google search

async function googleSearch(query) {
  const cx = process.env.CUSTOM_SEARCH_ID;
  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&num=1&cr=countryUS`;

  try {
    const response = await axios.get(url);
    if (response.data.items && response.data.items[0]) {
      return response.data.items[0].snippet;
    }
  } catch (error) {
    console.error(error);
  }
}

// MongoDB connection URI from your .env file
const mongoURI = process.env.MONGODB_URI;

async function clearConversationHistory(chatId) {
  let client;

  try {
    // Connect to MongoDB
    client = await MongoClient.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get a reference to the database
    const db = client.db();

    // Define the collection where conversation history is stored
    const collection = db.collection('chat_history');

    // Define the query to find the conversation history for a specific chatId
    const query = { chatId };

    // Delete the conversation history for the specified chatId
    const result = await collection.deleteMany(query);

    if (result.deletedCount > 0) {
      logger.info(`Deleted ${result.deletedCount} messages for chatId ${chatId}`);
      return true; // Successfully cleared conversation history
    } else {
      logger.info(`No messages found for chatId ${chatId}`);
      return false; // No messages found for the specified chatId
    }
  } catch (error) {
    logger.error(`Error clearing conversation history: ${error}`);
    return false; // An error occurred while clearing conversation history
  } finally {
    if (client) {
      client.close();
    }
  }
}

module.exports = { clearConversationHistory, openai, getChat, googleSearch };
