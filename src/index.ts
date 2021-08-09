import { App } from '@slack/bolt';

const app = new App({
  token: process.env.BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

app.event('message', async ({ event }) => {
  console.log(event);
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app started');
})();
