/* Clock, date and font settings (Prefs.appearance). */
(function () {
    'use strict';

    var FONTS = [
        { key: 'manrope', label: 'Manrope', family: '"Manrope"' },
        { key: 'inter', label: 'Inter', family: '"Inter"' },
        { key: 'outfit', label: 'Outfit', family: '"Outfit"' },
        { key: 'dm-sans', label: 'DM Sans', family: '"DM Sans"' }
    ];

    var LOCALES = [
        { key: 'en-GB', label: 'English' },
        { key: 'es-ES', label: 'Español' },
        { key: 'fr-FR', label: 'Français' }
    ];

    var FALLBACK = ', "SamsungOne", "Helvetica Neue", Arial, sans-serif';

    function prefs() { return Prefs.get().appearance; }

    function font(key) {
        return FONTS.find(function (f) { return f.key === key; }) || FONTS[0];
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    // Returns { time: '16:05', suffix: '' } or { time: '4:05', suffix: 'PM' }.
    function time(d) {
        if (prefs().clock === '12h') {
            var h = d.getHours() % 12 || 12;
            return { time: h + ':' + pad(d.getMinutes()), suffix: d.getHours() < 12 ? 'AM' : 'PM' };
        }
        return { time: pad(d.getHours()) + ':' + pad(d.getMinutes()), suffix: '' };
    }

    function date(d) {
        try {
            var text = d.toLocaleDateString(prefs().locale, { weekday: 'long', day: 'numeric', month: 'long' });
            return text.charAt(0).toUpperCase() + text.slice(1);
        } catch (e) {
            return d.toDateString();
        }
    }

    // Santa countdown, counted in sleeps (nights) to Christmas morning, local time.
    // Returns { n, title, sub }; after Christmas Day it counts to next year's.
    function santa(d) {
        var today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var year = today.getMonth() === 11 && today.getDate() > 25 ? today.getFullYear() + 1 : today.getFullYear();
        var xmas = new Date(year, 11, 25);
        var sleeps = Math.round((xmas - today) / 86400000);
        if (sleeps === 0) return { n: '', title: 'Merry Christmas!', sub: 'Santa\u2019s been!' };
        if (sleeps === 1) return { n: '', title: 'Santa comes tonight!', sub: 'Christmas Eve \u00b7 off to bed early' };
        var day = '';
        try {
            day = xmas.toLocaleDateString(prefs().locale, { weekday: 'short' }) + ' 25 Dec';
        } catch (e) {
            day = '25 Dec';
        }
        return { n: String(sleeps), title: 'sleeps till Santa', sub: 'Christmas Day \u00b7 ' + day };
    }

    function apply() {
        var p = prefs();
        document.documentElement.style.setProperty('--font', font(p.font).family + FALLBACK);
        var home = document.getElementById('home');
        home.classList.toggle('names-focused', p.names === 'focused');
        home.classList.toggle('names-never', p.names === 'never');
        home.classList.toggle('no-date', !p.showDate);
    }

    window.Appearance = {
        FONTS: FONTS,
        LOCALES: LOCALES,
        font: font,
        time: time,
        date: date,
        santa: santa,
        apply: apply
    };
})();
