/*
 * Powerwall battery beside the clock on Home (symbol and %), read from a pypowerwall
 * proxy on the local network (the TV cannot talk to the gateway itself: it only serves HTTPS
 * with a self-signed certificate, and its data needs the gateway password).
 *
 * config.local.js: powerwall: { bridge: 'http://<ip>:8675', gateway: '<gateway-ip>' }
 * `gateway` is only used by the Lab's direct-connection test.
 *
 * The bridge mirrors the gateway API:
 *   /api/system_status/soe    { percentage }               raw state of energy
 *   /api/meters/aggregates    { site, battery, load, solar }  each { instant_power } in watts
 * Signs: site > 0 importing from the grid, battery > 0 discharging, solar > 0 producing.
 */
(function () {
    'use strict';

    var POLL_MS = 30 * 1000;
    var STALE_MS = 5 * 60 * 1000;
    var CACHE_KEY = 'arn0.energy.v1';

    var cfg = (window.LAUNCHER_CONFIG || {}).powerwall || null;
    var el = null;
    var timer = null;
    var last = null;

    function bridge() {
        return cfg && cfg.bridge ? cfg.bridge.replace(/\/+$/, '') : '';
    }

    function enabled() {
        return !!bridge() || !!window.__TIZEN_MOCK__;
    }

    function getJson(url, ms) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.timeout = ms || 6000;
            xhr.onload = function () {
                if (xhr.status !== 200) return reject(new Error('HTTP ' + xhr.status));
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(new Error('reply was not JSON'));
                }
            };
            // status 0: no answer, refused, blocked, or (for HTTPS) an untrusted certificate.
            xhr.onerror = function () { reject(new Error('no connection (network, CORS or certificate)')); };
            xhr.ontimeout = function () { reject(new Error('timed out')); };
            xhr.send();
        });
    }

    // The gateway reports raw charge, which includes a 5% reserve the Tesla app hides.
    function appPercent(raw) {
        if (cfg && cfg.scaleSoe === false) return raw;
        return Math.max(0, Math.min(100, (raw - 5) / 0.95));
    }

    function power(agg, key) {
        return agg && agg[key] && typeof agg[key].instant_power === 'number' ? agg[key].instant_power : 0;
    }

    function sample() {
        return { pct: 72, battery: -1830, solar: 4620, home: 1210, grid: -1580, at: Date.now() };
    }

    function fetchNow() {
        if (window.__TIZEN_MOCK__ && !bridge()) return Promise.resolve(sample());
        var base = bridge();
        return Promise.all([
            getJson(base + '/api/system_status/soe'),
            getJson(base + '/api/meters/aggregates')
        ]).then(function (r) {
            return {
                pct: appPercent(r[0].percentage),
                battery: power(r[1], 'battery'),
                solar: power(r[1], 'solar'),
                home: power(r[1], 'load'),
                grid: power(r[1], 'site'),
                at: Date.now()
            };
        });
    }

    // ---------- Drawing

    function batteryIcon(pct) {
        var w = Math.round(17 * pct / 100);
        return '<svg viewBox="0 0 28 16" class="pw-batt"><rect x="1" y="1" width="23" height="14" rx="3" ' +
            'fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="25" y="5" width="2.5" height="6" rx="1" ' +
            'fill="currentColor"/><rect x="4" y="4" width="' + Math.max(w, 1) + '" height="8" rx="1.5" fill="currentColor"/></svg>';
    }

    var BOLT = '<svg viewBox="0 0 24 24" class="pw-bolt" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>';

    // Just the battery: symbol, percentage, and a small bolt while it charges.
    function render(x) {
        if (!el || !x) return;
        var stale = Date.now() - x.at > STALE_MS;
        var pct = Math.round(x.pct);
        el.className = 'pw-inline' + (stale ? ' stale' : '');
        el.innerHTML = batteryIcon(pct) + '<span>' + pct + '%</span>' + (x.battery < -50 && !stale ? BOLT : '');
    }

    function readCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY));
        } catch (e) {
            return null;
        }
    }

    function poll() {
        if (document.hidden) return;
        fetchNow().then(function (x) {
            last = x;
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(x)); } catch (e) { /* no cache */ }
            render(x);
        }, function (err) {
            if (window.DevLog) DevLog.log('Powerwall: ' + DevLog.errorText(err));
            render(last);   // redraw so the card shows its age
        });
    }

    function init() {
        el = document.getElementById('energy');
        if (!el || !enabled()) return;
        last = window.__TIZEN_MOCK__ && !bridge() ? null : readCache();
        render(last);
        poll();
        timer = setInterval(poll, POLL_MS);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) poll();
        });
    }

    // ---------- Lab tests

    function labBridge(log) {
        if (!bridge()) return Promise.reject(new Error('set powerwall.bridge in config.local.js first'));
        return fetchNow().then(function (x) {
            log('Bridge OK: ' + Math.round(x.pct) + '%, solar ' + x.solar + ' W, home ' + x.home +
                ' W, grid ' + x.grid + ' W, battery ' + x.battery + ' W');
        });
    }

    // /api/status needs no login, so it shows whether the TV accepts the gateway's certificate.
    function labDirect(log) {
        if (!cfg || !cfg.gateway) return Promise.reject(new Error('set powerwall.gateway in config.local.js first'));
        return getJson('https://' + cfg.gateway.replace(/^https?:\/\//, '') + '/api/status', 8000).then(function (s) {
            log('Gateway answered directly (firmware ' + (s.version || '?') + '). The TV accepts its certificate.');
        });
    }

    window.Energy = { init: init, labBridge: labBridge, labDirect: labDirect };
})();
