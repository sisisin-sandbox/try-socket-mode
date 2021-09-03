import { InstallProvider } from '@slack/oauth';
import { SocketModeClient } from '@slack/socket-mode';
import express from 'express';
import fs from 'fs';
import https from 'https';

const app = express();
const server = https.createServer(
  { key: fs.readFileSync(process.env.PRIV_KEY!, 'utf-8'), cert: fs.readFileSync(process.env.CERT!, 'utf-8') },
  app,
);
const socketClient = new SocketModeClient({ appToken: process.env.SLACK_APP_TOKEN! });

const installer = new InstallProvider({
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  stateSecret: 'my-state-secret',
});

app.get('/slack/install', async (req, res, next) => {
  const url = await installer.generateInstallUrl({
    scopes: [],
    userScopes: ['channels:read', 'channels:history', 'im:history'],
    redirectUri: 'https://local.sisisin.house:3000/slack/oauth_redirect',
  });

  res.send(
    `<a href=${url}><img alt=""Add to Slack"" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>`,
  );
});
app.get('/slack/oauth_redirect', async (req, res) => {
  await installer.handleCallback(req, res, {
    success: (installation, options, callbackReq, callbackRes) => {
      if ((callbackReq as any).session) {
        (callbackReq as any).session.slack = installation;
      }
      (callbackRes as any).redirect('/');
    },
  });
});
app.get('/', (req, res) => {
  res.send('ok');
});
socketClient.on('message', (event) => {
  event.ack();
  console.log(event.event.text);
});

async function main() {
  server.listen(process.env.PORT || 3000, () => {
    console.log(`server running`);
  });

  await socketClient.start();
}
main().catch((err) => console.error(err));
