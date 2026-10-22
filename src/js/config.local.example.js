/*
 * Personal settings that should never be committed: copy this file to config.local.js
 * (same folder) and fill it in. config.local.js is git-ignored but is packed into your
 * local build, so the TV gets it. Anything set here overrides config.js.
 */
Object.assign(window.LAUNCHER_CONFIG, {
    // Weather location (decimal degrees).
    weather: { latitude: -33.87, longitude: 151.21 },

    // Plex "Continue watching": your server's local address and X-Plex-Token.
    plex: { server: 'http://192.168.x.x:32400', token: 'your-plex-token', appId: 'kIciSQlYEM.plex', max: 12 },

    // Wallpapers from a Plex Photos library (uses the server and token above). New photos
    // appear within the hour. includeBundled: true keeps the built-in landscapes as well.
    photos: { library: 'TV Photos', max: 200, includeBundled: false }
});
