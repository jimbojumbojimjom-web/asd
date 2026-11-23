# Stormfall multiplayer

Last-player-standing 3D battle royale with building. Everyone who connects joins the same match.

## Run it
1. Install Node.js 18 or newer.
2. In this folder: `npm install` then `npm start`.
3. Open http://localhost:3000. Friends on your network open http://YOUR-LAN-IP:3000.

To play over the internet, deploy the folder to a host that supports WebSockets (Render, Railway, Fly.io) and share its URL. The server reads the PORT environment variable.

## Notes
- Rounds start immediately. With two or more players the last one alive wins, then a new round begins after 8 seconds.
- The server owns health, the storm, loot and building. Hit detection is reported by each shooter and only range-checked, so it suits friends, not strangers.
- The page loads Three.js from cdnjs, so players need internet access.
