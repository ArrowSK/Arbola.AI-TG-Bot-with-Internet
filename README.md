# AI Bot 🧿 - Arbola.AI

This is a simple Telegram bot that uses OpenAI's API to generate human-like responses. It can perform a Google search, generate an image from text and correct grammar errors.

## Commands

/know: This command performs a Google search on the given text and returns a human-like response. For example: /know What is the capital of France?

/picture: This command generates an image from the given text. For example: /picture A cat sitting on a couch.

/en: This command corrects grammar errors in the given text. For example: /en I has a apple.

/help: This command lists all available commands.

## Installation

To run this bot, you'll need to have Node.js and npm installed. Then, follow these steps:

1. Clone this repository.

2. Install the required packages by running npm install.

3. Create a .env file and set the following environment variables:

```makefile

  API: Your OpenAI API key.
  TG_API: Your Telegram bot token.
  CUSTOM_SEARCH_ID: Your Google Custom Search ID.
  GOOGLE_API_KEY: Your Google API key.
  ALLOWED_USERNAMES: usernames of those who are allowed to use the chatbot
```

4. Run node index.js to start the bot.

## Dependencies

<ul>
  <li>dotenv: Loads environment variables from a .env file.</li>
  <li>openai: Official OpenAI API wrapper for Node.js.</li>
  <li>telegraf: Modern Telegram Bot Framework for Node.js.</li>
  <li>axios: Promise based HTTP client for the browser and Node.js.</li>
  <li>winston: A logger for just about everything.</li>
  <li>util: The Node.js util module provides a collection of utility functions.</li>
  <li>bottleneck: Job scheduler and rate limiter.</li>
  <li>cheerio: A fast, flexible, and lean implementation of core jQuery for the server.</li>
</ul>
Based on the initial code from https://github.com/ChetanXpro but greatly deviated form the original.
