## Description

This code is for an OpenAI-powered Telegram bot with the direct Internet connection via Google Search, that has both worlds combined in one, and also applies critical (aka scientific) jusdgement to provide answers. Users can communicate with the bot to get responses to their queries using OpenAI's language model. This is the non-personal version made to be fully open and honest.

## Prerequisites

- Node.js
- Mongodb

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/arrowk/chatbot.git

2. Install the dependencies:

   ```sh
   npm install

3. Set the environment variables. Create a file named .env in the root directory and add the following:

    ```makefile
    MONGODB_URI=your-mongodb-endpoint-here
    TG_API=your-telegram-bot-token-here
    API=your-openai-api-key-here
    ALLOWED_USERNAMES=usernames of those who are allowed to use the chatbot
    BOT_OWNER_USER_ID=your own user id in Telegram

4. Start the bot:

   ```sh
   npm start
   
## Usage

Just talk to the bot.

## Additional Notes

This bot only responds to private messages.

The chat history is saved to MongoDB and is deleted every day at midnight CET.

Only certain Telegram usernames are allowed to access the bot (you can set your own via ALLOWED_USERNAMES variable).
