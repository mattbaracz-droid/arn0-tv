/*
 * "Continue watching" from a Plex Media Server on the local network.
 *
 * Reads the server's On Deck list (what is in progress, plus next episodes) and returns tile
 * data: a 16:9 still, a title, a subtitle and how far through it you are. Images come from the
 * server's own transcoder at tile size, so the TV never decodes a full-size poster.
 *
 * config.js: plex: { server: 'http://<ip>:32400', token: '<X-Plex-Token>', appId, max }
 * With no server or token set, Home simply has no Plex row.
 */
(function () {
    'use strict';

    var CACHE_KEY = 'arn0.plex.v1';
    var cfg = (window.LAUNCHER_CONFIG || {}).plex || null;

    function configured() {
        return !!(cfg && cfg.server && cfg.token);
    }

    function base() {
        return cfg.server.replace(/\/+$/, '');
    }

    function image(path, w, h) {
        if (!path) return '';
        return base() + '/photo/:/transcode?width=' + w + '&height=' + h + '&minSize=1&upscale=1' +
            '&url=' + encodeURIComponent(path) + '&X-Plex-Token=' + encodeURIComponent(cfg.token);
    }

    function get(path) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            var sep = path.indexOf('?') >= 0 ? '&' : '?';
            xhr.open('GET', base() + path + sep + 'X-Plex-Token=' + encodeURIComponent(cfg.token));
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.timeout = 8000;
            xhr.onload = function () {
                if (xhr.status !== 200) return reject(new Error('Plex replied ' + xhr.status));
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(new Error('Plex reply was not JSON'));
                }
            };
            xhr.onerror = function () { reject(new Error('Plex server not reachable')); };
            xhr.ontimeout = function () { reject(new Error('Plex server timed out')); };
            xhr.send();
        });
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    function toItem(m) {
        var episode = m.type === 'episode';
        var still = episode ? (m.thumb || m.grandparentArt || m.art) : (m.art || m.thumb);
        var progress = m.viewOffset && m.duration ? Math.min(1, m.viewOffset / m.duration) : 0;
        return {
            kind: 'plex',
            key: m.ratingKey,
            label: episode ? m.grandparentTitle : m.title,
            sub: episode ? 'S' + pad2(m.parentIndex || 0) + ' E' + pad2(m.index || 0) + ' · ' + m.title
                         : (m.year ? String(m.year) : ''),
            image: image(still, 480, 272),
            progress: progress
        };
    }

    // Newer servers expose On Deck as a hub; older ones under /library.
    function fetchDeck() {
        return get('/hubs/home/onDeck').catch(function () {
            return get('/library/onDeck');
        }).then(function (d) {
            var list = (d.MediaContainer && d.MediaContainer.Metadata) || [];
            return list.slice(0, cfg.max || 12).map(toItem);
        });
    }

    function sample() {
        return [
            { kind: 'plex', key: '1', label: 'Bluey', sub: 'S03 E12 · Cricket', image: '', progress: 0.4 },
            { kind: 'plex', key: '2', label: 'The Bear', sub: 'S02 E06 · Fishes', image: '', progress: 0.72 },
            { kind: 'plex', key: '3', label: 'Dune: Part Two', sub: '2024', image: '', progress: 0.18 },
            { kind: 'plex', key: '4', label: 'Mystery Road: Origin', sub: 'S01 E04 · The Crossing', image: '', progress: 0 }
        ];
    }

    function readCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function writeCache(items) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(items));
        } catch (e) {
            // Only the instant first draw is lost.
        }
    }

    // Resolves to the tile list; on failure keeps whatever was cached.
    function load() {
        if (window.__TIZEN_MOCK__ && !configured()) return Promise.resolve(sample());
        if (!configured()) return Promise.resolve([]);
        return fetchDeck().then(function (items) {
            writeCache(items);
            return items;
        });
    }

    // ---------- Photos library as wallpapers

    var PHOTOS_KEY = 'arn0.plexPhotos.v1';

    function photosCfg() {
        return (window.LAUNCHER_CONFIG || {}).photos || null;
    }

    function photosConfigured() {
        var pc = photosCfg();
        return configured() && !!(pc && pc.library);
    }

    // Finds the Photos library by name, then lists every photo in it (albums included).
    function fetchPhotos() {
        var pc = photosCfg();
        var want = String(pc.library).toLowerCase();
        return get('/library/sections').then(function (d) {
            var dirs = (d.MediaContainer && d.MediaContainer.Directory) || [];
            var lib = dirs.filter(function (x) { return x.type === 'photo' && String(x.title).toLowerCase() === want; })[0];
            if (!lib) throw new Error('no Photos library called "' + pc.library + '"');
            return get('/library/sections/' + lib.key + '/all?type=13&sort=addedAt:desc');
        }).then(function (d) {
            var list = (d.MediaContainer && d.MediaContainer.Metadata) || [];
            return list.slice(0, pc.max || 200).map(function (m) {
                var part = m.Media && m.Media[0] && m.Media[0].Part && m.Media[0].Part[0];
                var src = (part && part.key) || m.thumb;
                return {
                    key: 'plex-' + m.ratingKey,
                    title: m.title || 'Photo',
                    // minSize=1 fills the 1920x1080 box; CSS crops the rest (cover).
                    file: image(src, 1920, 1080),
                    thumb: image(m.thumb || src, 320, 180),
                    credit: '',
                    scrim: true
                };
            }).filter(function (w) { return w.file; });
        });
    }

    function cachedPhotos() {
        try {
            return JSON.parse(localStorage.getItem(PHOTOS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    // Resolves to the photo list; on failure the cached list stays in use.
    function loadPhotos() {
        if (!photosConfigured()) return Promise.resolve([]);
        return fetchPhotos().then(function (list) {
            try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(list)); } catch (e) { /* no cache */ }
            return list;
        });
    }

    window.Plex = {
        photosEnabled: photosConfigured,
        cachedPhotos: function () { return photosConfigured() ? cachedPhotos() : []; },
        loadPhotos: loadPhotos,
        enabled: function () { return configured() || !!window.__TIZEN_MOCK__; },
        appId: function () { return (cfg && cfg.appId) || 'kIciSQlYEM.plex'; },
        cached: function () { return configured() ? readCache() : (window.__TIZEN_MOCK__ ? sample() : []); },
        load: load
    };
})();
