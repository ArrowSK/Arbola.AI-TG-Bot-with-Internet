const { Configuration, OpenAIApi } = require("openai");
const logger = require("./logger");

const configuration = new Configuration({
  apiKey: process.env.API,
});

const openai = new OpenAIApi(configuration);

// Generate answer from prompt

async function getChat(text, messages) {
  try {
    const completion = await openai.chat.create({
      model: 'gpt-3.5-turbo',
		messages: [
		  {
		    role: 'system',
		    content: prompts.get(selectedPrompt) + promptWithResult,
		  },
		  ...messageList.map((msg) => ({
		    role: msg.from.id === ctx.botInfo.id ? 'assistant' : 'user',
		    content: msg.text,
		  })),
		];
      stream: true,
      max_tokens: 700,
      temperature: 0.3,
      frequency_penalty: 0.2,
      presence_penalty: 0.05,
    });

    let response = '';

    for await (const chunk of completion) {
      response += chunk.choices[0].message.content;
    }

    return response;
  } catch (error) {
    console.error(error);
    // Handle the error or log it as needed
  }
}

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


module.exports = { openai, getChat, googleSearch };
