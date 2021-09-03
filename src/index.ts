import { InstallProvider } from '@slack/oauth';
import { SocketModeClient } from '@slack/socket-mode';
import express from 'express';
import { redis } from './redis';
import fs from 'fs';
import https from 'https';
const key = fs.readFileSync(process.env.PRIV_KEY!, 'utf-8');
const cert = fs.readFileSync(process.env.CERT!, 'utf-8');

const options = { key, cert };
const app = express();
const server = https.createServer(options, app);

const appToken = process.env.SLACK_APP_TOKEN!;
const socketClient = new SocketModeClient({ appToken });

const installer = new InstallProvider({
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  stateSecret: 'my-state-secret',
  installationStore: {
    storeInstallation: async (installation) => {
      if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
        await redis.set(installation.enterprise.id, JSON.stringify(installation));
        await redis.set(installation.user.id, JSON.stringify(installation));
        return;
      }
      if (installation.team !== undefined) {
        await redis.set(installation.team.id, JSON.stringify(installation));
        await redis.set(installation.user.id, JSON.stringify(installation));
        return;
      }
      throw new Error('Failed saving installation data to installationStore');
    },
    fetchInstallation: async (installQuery) => {
      if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
        const res = await redis.get(installQuery.enterpriseId);
        // const res = await redis.get(installQuery.userId!);
        return JSON.parse(res!);
      }
      if (installQuery.teamId !== undefined) {
        const res = await redis.get(installQuery.teamId);
        // const res = await redis.get(installQuery.userId!);
        return JSON.parse(res!);
      }
      throw new Error('Failed fetching installation');
    },
    deleteInstallation: async (installQuery) => {
      if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
        await redis.del(installQuery.userId!);
        return;
      }
      if (installQuery.teamId !== undefined) {
        await redis.del(installQuery.userId!);
        return;
      }
      throw new Error('Failed to delete installation');
    },
  },
});

app.get('/slack/install', async (req, res, next) => {
  try {
    const url = await installer.generateInstallUrl({
      scopes: [],
      userScopes: ['channels:read', 'channels:history', 'im:history'],
      metadata: 'some_metadata',
      redirectUri: 'https://local.sisisin.house:3000/slack/oauth_redirect',
    });

    res.send(
      `<a href=${url}><img alt=""Add to Slack"" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>`,
    );
  } catch (error) {
    res.status(500);
    console.log(error);
    res.json({ error: 'some error' });
  }
});
app.get('/slack/oauth_redirect', async (req, res) => {
  try {
    await installer.handleCallback(req, res);
  } catch (error) {
    res.status(500);
    console.log(error);
    res.json({ error: 'some error' });
  }
});

socketClient.on('message', (event) => {
  console.log(event);
});

async function main() {
  server.listen(process.env.PORT || 3000, () => {
    console.log(`server running`);
  });

  await socketClient.start();
}
main().catch((err) => console.error(err));
