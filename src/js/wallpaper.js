/* Wallpaper display and rotation, driven by Prefs.wallpaper. */
(function () {
    'use strict';

    var INTERVALS = [
        { key: 'open', label: 'Each time Home opens', ms: 0 },
        { key: '30s', label: '30 s', ms: 30 * 1000 },
        { key: '5m', label: '5 min', ms: 5 * 60 * 1000 },
        { key: '15m', label: '15 min', ms: 15 * 60 * 1000 },
        { key: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
        { key: '1d', label: 'Daily', ms: 24 * 60 * 60 * 1000 }
    ];

    var token = 0;
    var SCRIM = 'img/scrim.png';

    // Photos from a Plex library (js/config.local.js → photos) replace the bundled set once
    // there are any; config photos.includeBundled keeps both.
    var plexPhotos = [];

    function list() {
        var bundled = window.WALLPAPERS || [];
        if (!plexPhotos.length) return bundled;
        var pc = (window.LAUNCHER_CONFIG || {}).photos || {};
        return pc.includeBundled ? plexPhotos.concat(bundled) : plexPhotos;
    }

    function setPlexPhotos(photos) {
        var before = plexPhotos.map(function (w) { return w.key; }).join(',');
        plexPhotos = photos || [];
        if (plexPhotos.map(function (w) { return w.key; }).join(',') === before) return;
        DevLog.log('Wallpapers: ' + plexPhotos.length + ' photos from Plex');
        apply();
    }

    function refreshPlexPhotos() {
        if (!window.Plex || !Plex.photosEnabled()) return;
        Plex.loadPhotos().then(setPlexPhotos, function (err) {
            DevLog.log('Plex photos: ' + DevLog.errorText(err));
        });
    }

    function find(key) {
        return list().find(function (w) { return w.key === key; }) || list()[0] || null;
    }

    function interval(key) {
        var find = function (k) { return INTERVALS.find(function (i) { return i.key === k; }); };
        return find(key) || find('15m');
    }

    function bg() { return document.getElementById('bg'); }

    // The next image is decoded before it replaces the current one, so the screen never flashes empty.
    // No wallpaper falls back to the stylesheet's plain gradient (img/bg.jpg).
    function display(w) {
        var t = ++token;
        if (!w) {
            bg().style.backgroundImage = '';
            return;
        }
        var img = new Image();
        img.onload = function () {
            if (t !== token) return;
            // Library photos have no scrim baked in, so a pre-rendered one is layered on top:
            // one extra still image, unlike a live gradient, which this TV draws very slowly.
            var url = 'url("' + w.file + '")';
            bg().style.backgroundImage = w.scrim ? 'url("' + SCRIM + '"), ' + url : url;
        };
        img.onerror = function () { DevLog.log('Wallpaper failed to load: ' + w.file); };
        img.src = w.file;
    }

    function apply() {
        var p = Prefs.get().wallpaper;
        display(p.mode === 'off' ? null : find(p.photo));
    }

    function next() {
        var p = Prefs.get().wallpaper;
        var l = list();
        if (!l.length) return null;
        var i = l.findIndex(function (w) { return w.key === p.photo; });
        p.photo = l[(i + 1) % l.length].key;
        p.lastChange = Date.now();
        if (p.mode === 'off') p.mode = 'photo';
        Prefs.save();
        apply();
        return find(p.photo);
    }

    function due() {
        var p = Prefs.get().wallpaper;
        var ms = interval(p.interval).ms;
        return p.mode === 'rotate' && ms > 0 && Date.now() - p.lastChange >= ms;
    }

    // Called when Home appears (launch or return from another app).
    function homeShown() {
        var p = Prefs.get().wallpaper;
        if (p.mode === 'rotate' && (p.interval === 'open' || due())) next();
    }

    function start() {
        if (window.Plex && Plex.photosEnabled()) plexPhotos = Plex.cachedPhotos();
        apply();
        homeShown();
        setTimeout(refreshPlexPhotos, 3000);
        setInterval(refreshPlexPhotos, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) setTimeout(refreshPlexPhotos, 1500);
        });
        // The screen saver has its own photo cycle and covers Home completely, so rotating
        // underneath it would only decode images nobody can see — and move the photo Home
        // comes back to.
        setInterval(function () {
            if (window.Screensaver && Screensaver.isOpen()) return;
            if (!document.hidden && due()) next();
        }, 5 * 1000);
    }

    window.Wallpaper = {
        INTERVALS: INTERVALS,
        list: list,
        find: find,
        interval: interval,
        apply: apply,
        next: next,
        homeShown: homeShown,
        start: start,
        refreshPlexPhotos: refreshPlexPhotos
    };
})();
