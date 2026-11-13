# Se7en Bot

iOS app (Expo / React Native) that is a front end for your own Hermes Agent server.
The design spec is in `OpenBot/Shared/app-design/se7en-bot/`.

## Run

```sh
npm install
npx expo start --tunnel   # scan the QR code with the Camera app; it opens in Expo Go
```

## Connect to Hermes

The app talks to the Hermes API server (`/api/sessions`, `/v1/runs`, `/api/jobs`).
On the Hermes machine:

```sh
# ~/.hermes/.env
API_SERVER_ENABLED=true
API_SERVER_KEY=<openssl rand -hex 32>
```

The API server can run terminal commands, so keep it off the public internet:
leave it on 127.0.0.1 and reach it through a private network, such as Tailscale Serve
(`tailscale serve --bg 8642`). Then run `hermes gateway`. In the app, tap **Anslut** and enter the server address
(for example a Tailscale Serve address such as `https://<machine>.<tailnet>.ts.net`) and the key.
The key is stored in the iOS Keychain.

## Check

```sh
npm run typecheck
npm test        # includes a mock Hermes server that speaks the real wire format
```
