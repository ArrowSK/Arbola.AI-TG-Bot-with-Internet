const { Configuration, OpenAIApi } = require("openai");
const logger = require("./logger");

const configuration = new Configuration({
  apiKey: process.env.API,
});

const openai = new OpenAIApi(configuration);

// Generate answer from prompt

const getChat = async (text, messages) => {
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [...messages, { role: "user", content: text }],
      max_tokens: 650,
      temperature: 0.3,
      frequency_penalty: 0.2,
      presence_penalty: 0.05,
    });

    return response.data.choices[0].message.content;
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


module.exports = { openai, getImage, getChat, correctEngish, googleSearch };
