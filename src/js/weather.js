/*
 * Weather beside the date on Home, from Open-Meteo (free, no key).
 *
 * One small request every 30 minutes at most, cached on the TV so Home draws instantly and
 * keeps the last reading when the network is down. Any failure just leaves the strip as it was.
 */
(function () {
    'use strict';

    var CACHE_KEY = 'arn0.weather.v1';
    var MAX_AGE_MS = 30 * 60 * 1000;

    // WMO weather codes grouped into the few icons worth drawing.
    function kind(code) {
        if (code === 0 || code === 1) return 'sun';
        if (code === 2) return 'part';
        if (code === 3) return 'cloud';
        if (code === 45 || code === 48) return 'fog';
        if (code >= 95) return 'storm';
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
        if (code >= 51) return 'rain';
        return 'cloud';
    }

    var LABELS = {
        sun: 'Clear', part: 'Partly cloudy', cloud: 'Cloudy', fog: 'Fog',
        rain: 'Rain', storm: 'Storms', snow: 'Snow'
    };

    // Stroke icons on a 24-unit grid, drawn in the text colour.
    var SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
    var CLOUD = '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 18z"/>';
    var ICONS = {
        sun: SUN,
        part: '<path d="M8 3.5v1.2M3.4 5.4l.9.9M2 10h1.2M12.6 5.4l-.9.9"/><path d="M5.3 12.4A3.5 3.5 0 0 1 11 7.6"/>' +
              '<path d="M9 20h8.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 9 20z"/>',
        cloud: CLOUD,
        fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
        rain: '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
        storm: '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>',
        snow: '<path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M9 19h.01M12 21h.01M15 19h.01"/>'
    };

    var cfg = (window.LAUNCHER_CONFIG || {}).weather;
    var el = null;
    var inFlight = false;

    function readCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY));
        } catch (e) {
            return null;
        }
    }

    function writeCache(w) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(w));
        } catch (e) {
            // Only the instant first draw is lost.
        }
    }

    function render(w) {
        if (!el || !w) return;
        var k = kind(w.code);
        el.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
            'stroke-linecap="round" stroke-linejoin="round">' + ICONS[k] + '</svg>' +
            '<span class="wx-now">' + Math.round(w.temp) + '°</span>' +
            '<span class="wx-range">' + Math.round(w.max) + '° / ' + Math.round(w.min) + '°</span>' +
            '<span class="wx-text">' + LABELS[k] + '</span>';
        el.classList.remove('hidden');
    }

    function url() {
        return 'https://api.open-meteo.com/v1/forecast' +
            '?latitude=' + cfg.latitude + '&longitude=' + cfg.longitude +
            '&current=temperature_2m,weather_code' +
            '&daily=temperature_2m_max,temperature_2m_min' +
            '&timezone=auto&forecast_days=1';
    }

    function sample() {
        return { temp: 23.4, code: 2, max: 26.1, min: 17.8, at: Date.now() };
    }

    function refresh(force) {
        if (!cfg || inFlight) return;
        var cached = readCache();
        if (!force && cached && Date.now() - cached.at < MAX_AGE_MS) return;
        if (window.__TIZEN_MOCK__ && cfg.previewSample !== false) {
            render(sample());
            return;
        }
        inFlight = true;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url());
        xhr.timeout = 10000;
        xhr.onload = function () {
            inFlight = false;
            try {
                var d = JSON.parse(xhr.responseText);
                var w = {
                    temp: d.current.temperature_2m,
                    code: d.current.weather_code,
                    max: d.daily.temperature_2m_max[0],
                    min: d.daily.temperature_2m_min[0],
                    at: Date.now()
                };
                writeCache(w);
                render(w);
            } catch (e) {
                if (window.DevLog) DevLog.log('Weather: unreadable reply');
            }
        };
        xhr.onerror = xhr.ontimeout = function () {
            inFlight = false;
            if (window.DevLog) DevLog.log('Weather: request failed');
        };
        xhr.send();
    }

    function init() {
        el = document.getElementById('weather');
        if (!el || !cfg) return;
        render(readCache());
        refresh(false);
        setInterval(function () { refresh(false); }, 10 * 60 * 1000);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) refresh(false);
        });
    }

    window.Weather = { init: init, refresh: refresh };
})();
