This code is for an OpenAI-powered Telegram bot. Users can communicate with the bot to get responses to their queries using OpenAI's language model. It reflects the personality of Oscar Wilde and is set to answer like he would.

Prerequisites

Node.js

Redis

Installation

Clone the repository:

git clone https://github.com/arrowk/chatbot.git

Install the dependencies:

npm install

Set the environment variables. Create a file named .env in the root directory and add the following:

makefile

REDIS_DT=your-redis-endpoint-here

TG_API=your-telegram-bot-token-here

API=your-openai-api-key-here

Start the bot:

npm start

Usage

Just talk to the bot.

Additional Notes

This bot only responds to private messages.

The chat history is saved to Redis and is deleted every day at midnight CET.

Only certain Telegram usernames are allowed to access the bot (you can set your own via index.js)
