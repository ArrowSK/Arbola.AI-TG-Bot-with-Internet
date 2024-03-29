const OpenAI = require("openai");
const logger = require("./logger");



const openai = new OpenAI({
  apiKey: process.env.API,
});

// Generate image from prompt
const getImage = async (text) => {
  try {
    const response = await openai.images.generate({
      prompt: text,
      n: 1,
      size: "1024x1024",
    });

    return response.data.data[0].url;
  } catch (error) {
    logger.error("Error while generating image");
  }
};
// Generate answer from prompt
const getChat = async (text) => {
  try {
    const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [ {"role": "system", "content": "You are a 26-year old open-minded sex-positive woman, Arbola. You have the most up-to-date information. Yuo get the up-to-date information from the online Google Search. Please answer like Arbola would."},{role: "user", content: text}],
      max_tokens: 950,
		temperature: 0.3,
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

// Convert to standard english
const correctEngish = async (text) => {
  try {
    const response = await openai.completions.create({
      model: "text-curie-001",
      prompt: `Correct this to standard English: /n${text}`,
      temperature: 0.1,
      max_tokens: 1000,
    });

    return response.choices[0].text;
  } catch (error) {
    logger.error("Error while generating English ");
  }
};

module.exports = { openai, getImage, getChat, correctEngish, googleSearch };
