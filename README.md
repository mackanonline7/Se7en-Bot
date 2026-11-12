# Se7en Bot

iOS app (Expo / React Native) that is a front end for your own Hermes Agent server.
The design spec is in `OpenBot/Shared/app-design/se7en-bot/`.

## Run

```sh
npm install
npx expo start --tunnel   # scan the QR code with the Camera app; it opens in Expo Go
```

## Connect to Hermes

The app talks to the Hermes API server (`/api/sessions`, `/v1/runs`, `/api/jobs`, `/v1/toolsets`).
On the Hermes machine:

```sh
# ~/.hermes/.env
API_SERVER_ENABLED=true
API_SERVER_KEY=<openssl rand -hex 32>
API_SERVER_HOST=0.0.0.0   # the default 127.0.0.1 is not reachable from a phone
```

The API server can run terminal commands, so keep it off the public internet:
prefer a private network such as Tailscale over an open port. Then run `hermes gateway`. In the app, tap **Anslut** and enter the server address
(for example `http://192.168.1.10:8642`, or a Tailscale address) and the key.
The key is stored in the iOS Keychain.

## Check

```sh
npm run typecheck
npm test        # includes a mock Hermes server that speaks the real wire format
```
