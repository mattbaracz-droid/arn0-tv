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
    photos: { library: 'TV Photos', max: 200, includeBundled: false },

    // Tesla Powerwall card. bridge: the pypowerwall proxy (e.g. on the Shield or a Pi).
    // gateway: the Powerwall's own IP, used only by the Lab's direct-connection test.
    // scaleSoe: false shows the gateway's raw % instead of the Tesla app's figure.
    powerwall: { bridge: 'http://192.168.x.x:8675', gateway: '192.168.x.x' }
});
