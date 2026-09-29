// studio's webkit is from 2011, es5 only

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
body { margin: 0; font: 13px/1.4 "Source Sans Pro", Arial, Helvetica, sans-serif; color: #343434; background: #fff; }
a { color: #0055b3; text-decoration: none; }
a:hover { text-decoration: underline; }
h1 { margin: 0 0 4px; font-size: 24px; font-weight: normal; letter-spacing: -1px; }
h2 { margin: 0 0 10px; font-size: 17px; font-weight: bold; }
p { margin: 0 0 10px; }
.muted { color: #777; }
.btn { display: inline-block; padding: 4px 14px; border: 1px solid #02b757; border-radius: 3px; background: #02b757; color: #fff; font: inherit; font-size: 15px; cursor: pointer; }
.btn:hover { background: #3fc679; border-color: #3fc679; text-decoration: none; }
.btn.grey { background: #f2f2f2; border-color: #b8b8b8; color: #343434; }
.btn.grey:hover { background: #e6e6e6; }
.btn.small { padding: 2px 10px; font-size: 13px; }
input[type=text], input[type=password] { padding: 5px 6px; border: 1px solid #b8b8b8; border-radius: 3px; font: inherit; }
.status { margin-top: 12px; min-height: 18px; }
.status.err { color: #cb0000; }
.status.ok { color: #02b757; }
`;

const page = (title: string, body: string, css: string, js: string) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${CSS}${css}</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>
`;

const XHR = `
function xhr(method, url, body, type, done) {
    var r = new XMLHttpRequest();
    r.open(method, url, true);
    if (type) r.setRequestHeader("Content-Type", type);
    r.onreadystatechange = function () {
        if (r.readyState !== 4) return;
        var data = null;
        try { data = JSON.parse(r.responseText); } catch (e) {}
        done(r.status, data, r.responseText);
    };
    r.send(body || null);
}
var base = location.protocol + "//" + location.host;
function trim(s) { return String(s || "").replace(/^\\s+|\\s+$/g, ""); }
function $(id) { return document.getElementById(id); }
function show(id, text, cls) { var el = $(id); el.innerHTML = text; el.className = "status " + (cls || ""); }
`;

export type WelcomeData = {
    user: { id: number, username: string } | null;
    places: { id: number, title: string, icon: string }[];
    recent: { path: string, name: string }[];
    showLogin: boolean;
};

export const welcomePage = ({ user, places, recent, showLogin }: WelcomeData) => {
    const login = `
        <div class="box">
            <h2>Log in to NoneRev</h2>
            ${showLogin ? `<p class="muted">You need to log in before you can publish or edit places.</p>` : ""}
            <form id="login" onsubmit="return false">
                <div class="row"><label>Username</label><input type="text" id="u" autocomplete="off"></div>
                <div class="row"><label>Password</label><input type="password" id="pw"></div>
                <div class="row"><label></label><button class="btn" id="go">Log In</button></div>
            </form>
            <div id="status" class="status"></div>
        </div>`;

    const list = places.length
        ? places.map(p => `
            <div class="place">
                <img src="${esc(p.icon || "/img/DefaultPlaceIcon.jpg")}" alt="">
                <div class="title">${esc(p.title)}</div>
                <div class="muted">Place ${p.id}</div>
                <button class="btn small edit" data-id="${p.id}">Edit</button>
            </div>`).join("")
        : `<p class="muted">You have no places yet. Build something and use File &gt; Publish to NoneRev.</p>`;

    const recentList = recent.length
        ? recent.map(r => `<div class="recent"><a href="#" class="open" data-path="${esc(r.path)}" title="${esc(r.path)}">${esc(r.name)}</a></div>`).join("")
        : `<p class="muted">Files you open show up here.</p>`;

    const body = `
    <div class="top">
        <span class="logo">NoneRev</span> <span class="sub">Studio</span>
        <span class="right">${user ? `Hi, <b>${esc(user.username)}</b> &middot; <a href="#" id="logout">Log out</a>` : `<a href="${esc("/signup")}" target="_blank">Sign up on the website</a>`}</span>
    </div>
    <div class="wrap">
        ${user ? `<div class="box"><h2>My Places</h2>${list}</div>` : login}
        <div class="box"><h2>Recent Files</h2>${recentList}</div>
    </div>`;

    const css = `
.top { padding: 10px 20px; background: #f2f2f2; border-bottom: 1px solid #ccc; }
.logo { font-size: 22px; font-weight: bold; color: #7b2cbf; letter-spacing: -1px; }
.sub { font-size: 16px; color: #777; }
.right { float: right; padding-top: 5px; }
.wrap { padding: 20px; }
.box { margin-bottom: 24px; padding: 14px 16px; border: 1px solid #ddd; border-radius: 3px; background: #fff; }
.row { margin-bottom: 8px; }
.row label { display: inline-block; width: 80px; }
.row input { width: 200px; }
.place { position: relative; min-height: 70px; padding: 6px 90px 6px 80px; border-top: 1px solid #eee; }
.place img { position: absolute; left: 0; top: 6px; width: 64px; height: 64px; border: 1px solid #ccc; }
.place .title { padding-top: 10px; font-size: 15px; font-weight: bold; }
.place .edit { position: absolute; right: 0; top: 24px; }
.recent { padding: 3px 0; }
`;

    const js = XHR + `
if ($("go")) {
    $("go").onclick = function () {
        show("status", "Logging in...");
        xhr("POST", base + "/api/auth/login", JSON.stringify({ username: trim($("u").value), password: $("pw").value }), "application/json", function (code, data) {
            if (code === 200) { location.reload(); return; }
            show("status", (data && data.error) || "Login failed.", "err");
        });
    };
}
if ($("logout")) {
    $("logout").onclick = function () {
        xhr("GET", base + "/game/logout.aspx", null, null, function () { location.reload(); });
        return false;
    };
}
function each(cls, fn) { var els = document.getElementsByTagName("*"); for (var i = 0; i < els.length; i++) if ((" " + els[i].className + " ").indexOf(" " + cls + " ") >= 0) fn(els[i]); }
each("edit", function (b) {
    b.onclick = function () {
        var id = b.getAttribute("data-id");
        b.disabled = true;
        b.innerHTML = "Opening...";
        try {
            window.external.StartGame("", "", base + "/Game/edit.ashx?PlaceID=" + id + "&upload=" + id + "&testmode=false&universeId=" + id);
        } catch (e) {}
        b.disabled = false;
        b.innerHTML = "Edit";
    };
});
each("open", function (a) {
    a.onclick = function () {
        try { window.external.OpenRecentFile(a.getAttribute("data-path")); } catch (e) {}
        return false;
    };
});
`;
    return page("NoneRev Studio", body, css, js);
};

export const toolboxPage = (loggedIn: boolean) => {
    const body = `
    <div class="bar">
        <select id="cat">
            <option value="fm">Free Models</option>
            <option value="fd">Free Decals</option>
            ${loggedIn ? `<option value="mm">My Models</option><option value="md">My Decals</option>` : ""}
        </select>
        <form id="search" onsubmit="return false"><input type="text" id="q" placeholder="Search"><button class="btn small" id="find">Go</button></form>
    </div>
    <div id="status" class="status"></div>
    <div id="results"></div>
    <div id="pager" style="display:none"><a href="#" id="prev">&lsaquo; Prev</a> <span id="pageno"></span> <a href="#" id="next">Next &rsaquo;</a></div>`;

    const css = `
body { background: #f2f2f2; }
.bar { padding: 8px; background: #e6e6e6; border-bottom: 1px solid #ccc; }
.bar select { width: 100%; margin-bottom: 6px; font: inherit; }
.bar input { width: 70%; }
.bar .btn { margin-left: 4px; vertical-align: top; }
.status { margin: 6px 8px; }
#results { padding: 4px; }
.item { display: inline-block; width: 82px; margin: 4px; vertical-align: top; text-align: center; cursor: pointer; }
.item img { display: block; width: 72px; height: 72px; margin: 0 auto 3px; border: 1px solid #ccc; background: #fff; }
.item:hover img { border-color: #02b757; }
.item .name { display: block; height: 32px; overflow: hidden; font-size: 12px; line-height: 16px; color: #343434; }
.item .by { display: block; font-size: 11px; color: #888; overflow: hidden; white-space: nowrap; }
.item a { text-decoration: none; }
#pager { padding: 8px; text-align: center; }
`;

    const js = XHR + `
var cat = "fm";
var pg = 1;
var q = "";
var per = 21;
var total = 0;
var pressed = null;
var sx = 0;
var sy = 0;
var dragging = false;
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
function assetUrl(id) { return base + "/asset/?id=" + id; }
function load() {
    show("status", "Loading...");
    $("results").innerHTML = "";
    $("pager").style.display = "none";
    var mine = cat === "mm" || cat === "md";
    var type = cat === "fm" || cat === "mm" ? "fm" : "fd";
    xhr("GET", base + "/Game/Tools/InsertAsset.ashx?type=" + type + "&q=" + encodeURIComponent(q) + "&pg=" + pg + "&rs=" + per + (mine ? "&mine=1" : ""), null, null, function (code, data) {
        if (code !== 200 || !data || !data[0]) { show("status", "Could not load the toolbox.", "err"); return; }
        var list = data[0].Results || [];
        total = data[0].TotalCount || 0;
        if (!list.length) { show("status", mine ? "Nothing published yet. Select something and use File > Publish Selection to NoneRev." : "No results."); return; }
        var html = "";
        for (var i = 0; i < list.length; i++) {
            var r = list[i];
            html += '<div class="item" data-id="' + r.AssetId + '"><span id="span_setitem_' + r.AssetId + '"><a href="#" title="' + esc(r.Name) + '"><img src="' + esc(r.Thumbnail.Url) + '" alt=""><span class="name">' + esc(r.Name) + '</span></a></span><span class="by">' + esc(r.CreatorName) + '</span></div>';
        }
        $("results").innerHTML = html;
        show("status", "");
        $("pageno").innerHTML = "Page " + pg;
        $("prev").style.visibility = pg > 1 ? "visible" : "hidden";
        $("next").style.visibility = pg * per < total ? "visible" : "hidden";
        $("pager").style.display = "block";
    });
}
function item(el) {
    while (el && el !== document.body) {
        if ((" " + el.className + " ").indexOf(" item ") >= 0) return el;
        el = el.parentNode;
    }
    return null;
}
$("results").onmousedown = function (e) {
    e = e || window.event;
    pressed = item(e.target || e.srcElement);
    sx = e.clientX;
    sy = e.clientY;
};
$("results").onmousemove = function (e) {
    e = e || window.event;
    if (!pressed) return;
    if (Math.abs(e.clientX - sx) < 5 && Math.abs(e.clientY - sy) < 5) return;
    var id = pressed.getAttribute("data-id");
    pressed = null;
    dragging = true;
    try { window.external.StartDrag(assetUrl(id)); } catch (err) {}
    setTimeout(function () { dragging = false; }, 100);
};
$("results").onmouseup = function () { pressed = null; };
$("results").onclick = function (e) {
    e = e || window.event;
    var el = item(e.target || e.srcElement);
    if (el && !dragging) {
        try { window.external.Insert(assetUrl(el.getAttribute("data-id"))); } catch (err) {}
    }
    return false;
};
$("cat").onchange = function () { cat = this.value; pg = 1; load(); };
$("find").onclick = function () { q = trim($("q").value); pg = 1; load(); };
$("prev").onclick = function () { if (pg > 1) { pg--; load(); } return false; };
$("next").onclick = function () { pg++; load(); return false; };
document.body.onselectstart = function () { return false; };
load();
`;
    return page("Toolbox", body, css, js);
};

export const publishPage = (user: { username: string } | null, places: { id: number, title: string, has_file: boolean }[]) => {
    const body = user ? `
    <h1>Publish to NoneRev</h1>
    <p class="muted">Publishing as <b>${esc(user.username)}</b>. Pick a place to overwrite, or make a new one.</p>
    <form id="f" onsubmit="return false">
        <div class="places">
            <label class="place"><input type="radio" name="p" value="new" checked> <b>New place</b> <input type="text" id="name" placeholder="Name your place" maxlength="100"></label>
            ${places.map(p => `<label class="place"><input type="radio" name="p" value="${p.id}"> <b>${esc(p.title)}</b> <span class="muted">${p.has_file ? `place ${p.id}` : `place ${p.id}, nothing published yet`}</span></label>`).join("")}
        </div>
        <button class="btn" id="go">Publish</button>
        <button class="btn grey" id="cancel">Cancel</button>
        <div id="status" class="status"></div>
    </form>` : `
    <h1>Publish to NoneRev</h1>
    <p>You are not logged in. Log in on the Start Page first, then try again.</p>
    <button class="btn grey" id="cancel">Close</button>`;

    const css = `
body { padding: 20px; }
.places { max-height: 300px; margin: 14px 0; overflow: auto; border: 1px solid #ddd; }
.place { display: block; padding: 7px 10px; border-bottom: 1px solid #eee; cursor: pointer; }
.place:hover { background: #f7f7f7; }
.place input[type=text] { width: 220px; margin-left: 6px; }
`;

    const js = XHR + `
function chosen() {
    var r = document.getElementsByName("p");
    for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].value;
    return "new";
}
function save(id) {
    show("status", "Publishing...");
    setTimeout(function () {
        var ok = false;
        try { ok = window.external.SaveUrl(base + "/Data/Upload.ashx?assetid=" + id); } catch (e) {}
        if (ok) {
            show("status", "Published. This window will close.", "ok");
            setTimeout(function () { window.close(); }, 1200);
        } else {
            show("status", "Publishing failed. Make sure you are logged in to Studio and try again.", "err");
        }
    }, 30);
}
if ($("go")) {
    $("go").onclick = function () {
        var v = chosen();
        if (v !== "new") { save(v); return; }
        var name = trim($("name").value);
        if (!name) { show("status", "Give the new place a name.", "err"); $("name").focus(); return; }
        show("status", "Creating the place...");
        xhr("POST", base + "/IDE/publishas", "name=" + encodeURIComponent(name), "application/x-www-form-urlencoded", function (code, data) {
            if (code !== 200 || !data || !data.id) { show("status", (data && data.error) || "Could not create the place.", "err"); return; }
            save(data.id);
        });
    };
}
$("cancel").onclick = function () { window.close(); };
`;
    return page("Publish to NoneRev", body, css, js);
};

export const saveModelPage = (user: { username: string } | null, kind: string) => {
    const what = kind === "Lua" ? "script" : "model";
    const body = user ? `
    <h1>Publish Selection to NoneRev</h1>
    <p class="muted">The selected ${what} gets published as a model under your account. It then shows up in the Toolbox under My Models.</p>
    <form id="f" onsubmit="return false">
        <div class="row"><label>Name</label><input type="text" id="name" maxlength="100" placeholder="My ${what}"></div>
        <div class="row"><label>Description</label><input type="text" id="desc" maxlength="255"></div>
        <button class="btn" id="go">Publish</button>
        <button class="btn grey" id="cancel">Cancel</button>
        <div id="status" class="status"></div>
    </form>` : `
    <h1>Publish Selection to NoneRev</h1>
    <p>You are not logged in. Log in on the Start Page first, then try again.</p>
    <button class="btn grey" id="cancel">Close</button>`;

    const css = `
body { padding: 20px; }
.row { margin-bottom: 8px; }
.row label { display: inline-block; width: 90px; }
.row input { width: 260px; }
`;

    const js = XHR + `
if ($("go")) {
    $("go").onclick = function () {
        var name = trim($("name").value);
        if (!name) { show("status", "Give it a name.", "err"); $("name").focus(); return; }
        show("status", "Publishing...");
        setTimeout(function () {
            var id = "";
            try {
                var content = window.external.WriteSelection();
                id = content.Upload(base + "/Data/NewAsset.ashx?type=10&Name=" + encodeURIComponent(name) + "&Description=" + encodeURIComponent(trim($("desc").value)));
            } catch (e) {}
            if (parseInt(id, 10) > 0) {
                show("status", "Published as asset " + id + ". This window will close.", "ok");
                setTimeout(function () { window.close(); }, 1200);
            } else {
                show("status", "Publishing failed. Select something in the Explorer and make sure you are logged in.", "err");
            }
        }, 30);
    };
}
$("cancel").onclick = function () { window.close(); };
`;
    return page("Publish Selection to NoneRev", body, css, js);
};

export const html = (body: string) =>
    new Response(body, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
