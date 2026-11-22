// Semencraft III: registro, pago por Yape y panel de admins.
// Todo pasa por la funcion sc-api de Supabase; la pagina solo conoce la clave publica.
"use strict";

const SUPABASE_URL = "https://zhvwcnawpcmkpgeqmnjb.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_ToA4lpw4PSx2z27FD_cR4Q_nSN1D-Jl";
const API_URL = SUPABASE_URL + "/functions/v1/sc-api";
const LAUNCHER_URL = "https://github.com/XK-GamerX/SemencraftLauncherJavaFX/releases/latest";
const RELEASE_API = "https://api.github.com/repos/XK-GamerX/SemencraftLauncherJavaFX/releases/latest";
/** Mientras responde la API se muestra esto, para no dejar la pagina en blanco. */
const DEFAULT_CONFIG = { yapeNumber: "+51 977 557 854", priceRegular: 3, priceLate: 5, deadline: "2026-12-19T05:00:00Z", discordInvite: "https://discord.gg/WBaA4UrVvU" };
DEFAULT_CONFIG.priceNow = Date.now() < Date.parse(DEFAULT_CONFIG.deadline) ? DEFAULT_CONFIG.priceRegular : DEFAULT_CONFIG.priceLate;
const DISCORD_URL = "https://discord.gg/WBaA4UrVvU";
const SESSION_KEY = "semencraft.session";

const state = {
  token: readSession(),
  profile: null,
  config: null,
  admin: { tab: "payments", users: [], payments: [], filter: "all", search: "", paymentStatus: "pending" },
};

const app = document.getElementById("app");
const nav = document.getElementById("topnav");

// ---------- API ----------

async function api(action, body = {}) {
  const headers = { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" };
  if (state.token) headers["x-sc-session"] = state.token;
  let response;
  try {
    response = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify({ action, ...body }) });
  } catch {
    throw new ApiError("No hay conexion con el servidor. Revisa tu internet.", "network");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    if (data.code === "no_session" && state.token) {
      setSession(null);
      state.profile = null;
    }
    throw new ApiError(data.error || "Algo salio mal. Intenta de nuevo.", data.code || "error", data);
  }
  return data;
}

class ApiError extends Error {
  constructor(message, code, data = {}) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function setSession(token) {
  state.token = token || "";
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sin almacenamiento la sesion dura hasta cerrar la pestana.
  }
}

async function loadConfig() {
  if (state.config) return state.config;
  try {
    state.config = (await api("config")).config;
  } catch {
    state.config = DEFAULT_CONFIG;
  }
  return state.config;
}

let installerPromise = null;

/** Enlace directo al .msi de la ultima version publicada en GitHub (o la pagina de descargas si falla). */
function latestInstaller() {
  installerPromise ??= fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("GitHub " + r.status))))
    .then((release) => {
      const asset = (release.assets || []).find((a) => a.name.toLowerCase().endsWith(".msi"));
      return asset
        ? { url: asset.browser_download_url, version: release.tag_name, size: asset.size }
        : { url: LAUNCHER_URL, version: release.tag_name, size: 0 };
    })
    .catch(() => ({ url: LAUNCHER_URL, version: "", size: 0 }));
  return installerPromise;
}

/** Convierte los botones [data-download] en descarga directa del instalador. */
function bindDownloadButtons(root = document) {
  const buttons = root.querySelectorAll("[data-download]");
  if (!buttons.length) return;
  latestInstaller().then((info) => {
    buttons.forEach((b) => {
      b.href = info.url;
      b.removeAttribute("target");
      const label = b.parentElement?.querySelector("[data-download-info]");
      if (label && info.version) label.textContent = `Versión ${info.version.replace(/^v/i, "")}${info.size ? ` · ${Math.round(info.size / 1048576)} MB` : ""} · para Windows`;
    });
  });
}

async function loadProfile() {
  if (!state.token) return null;
  try {
    state.profile = (await api("me")).profile;
  } catch (error) {
    if (error.code === "banned") state.profile = { banned: true, banMessage: error.message };
    else state.profile = null;
  }
  return state.profile;
}

// ---------- Utilidades ----------

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function h(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content;
}

function soles(amount) {
  const n = Number(amount);
  return "S/" + (Number.isInteger(n) ? n : n.toFixed(2));
}

function date(iso, withTime = true) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "long" });
}

function ago(iso) {
  if (!iso) return "nunca";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

function toast(message, kind = "ok") {
  const el = h(`<div class="toast toast-${kind}">${esc(message)}</div>`).firstElementChild;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

const ICON = {
  user: '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20v-1c0-2.8 3.6-5 8-5s8 2.2 8 5v1z"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM9 10h6V8a3 3 0 0 0-6 0z"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M11 16V7.8l-3.3 3.3-1.4-1.4L12 4l5.7 5.7-1.4 1.4L13 7.8V16zM5 18h14v2H5z"/></svg>',
};

function modal(html, onReady) {
  const layer = document.getElementById("modal");
  layer.innerHTML = "";
  layer.appendChild(h(html));
  layer.hidden = false;
  const close = () => {
    layer.hidden = true;
    layer.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  layer.onclick = (e) => {
    if (e.target === layer || e.target.closest("[data-close]")) close();
  };
  onReady?.(layer, close);
  return close;
}

function confirmModal(title, text, confirmLabel, danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const close = modal(`
      <div class="modal">
        <h2>${esc(title)}</h2>
        <p class="muted">${esc(text)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancelar</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(confirmLabel)}</button>
        </div>
      </div>`, (layer) => {
      layer.querySelector("[data-ok]").onclick = () => {
        done = true;
        close();
        resolve(true);
      };
    });
    const observer = new MutationObserver(() => {
      if (document.getElementById("modal").hidden) {
        observer.disconnect();
        if (!done) resolve(false);
      }
    });
    observer.observe(document.getElementById("modal"), { attributes: true });
    void close;
  });
}

function secretModal(title, text, secret) {
  modal(`
    <div class="modal">
      <h2>${esc(title)}</h2>
      <p class="muted">${esc(text)}</p>
      <div class="secret">${esc(secret)}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-copy>Copiar</button>
        <button class="btn btn-primary" data-close>Listo</button>
      </div>
    </div>`, (layer) => {
    layer.querySelector("[data-copy]").onclick = () => navigator.clipboard?.writeText(secret).then(() => toast("Copiado."));
  });
}

/** Cabeza del jugador sacada de su skin de Semencraft (la cara y el sombrero), o la de Steve. */
function headImg(username) {
  const img = document.createElement("canvas");
  img.width = 8;
  img.height = 8;
  img.className = "head";
  const skin = new Image();
  skin.crossOrigin = "anonymous";
  skin.onload = () => {
    const ctx = img.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(skin, 8, 8, 8, 8, 0, 0, 8, 8);
    ctx.drawImage(skin, 40, 8, 8, 8, 0, 0, 8, 8);
  };
  skin.onerror = () => {
    if (!skin.dataset.fallback) {
      skin.dataset.fallback = "1";
      skin.src = "assets/steve.png";
    }
  };
  skin.src = `${SUPABASE_URL}/storage/v1/object/public/player-skins/${encodeURIComponent(String(username).toLowerCase())}/skin.png`;
  return img;
}

function accessBadge(user) {
  if (user.banned) return '<span class="badge badge-red">Baneado</span>';
  if (user.access === "granted") return '<span class="badge badge-green">Con acceso</span>';
  if (user.access === "revoked") return '<span class="badge badge-red">Acceso retirado</span>';
  return '<span class="badge badge-amber">Pendiente</span>';
}

function paymentBadge(status) {
  return {
    approved: '<span class="badge badge-green">Pagado</span>',
    pending: '<span class="badge badge-amber">Por revisar</span>',
    rejected: '<span class="badge badge-red">Rechazado</span>',
  }[status] || '<span class="badge">Sin pago</span>';
}

// ---------- Navegacion ----------

const ROUTES = { "": home, login: login, registro: register, cuenta: account, admin: admin };

async function route() {
  const name = location.hash.replace(/^#\/?/, "").split("/")[0];
  const view = ROUTES[name] ?? home;
  document.body.classList.remove("drawer-open");
  closeDrawer();
  renderNav(name);
  app.innerHTML = '<div class="sc-wait"><div class="sc-wait-ring"></div></div>';
  try {
    await view();
  } catch (error) {
    app.innerHTML = "";
    app.appendChild(h(`<div class="card"><h2>No se pudo cargar</h2><p class="muted">${esc(error.message)}</p></div>`));
  }
  window.scrollTo(0, 0);
}

function renderNav(current) {
  const p = state.profile;
  const link = (href, label, key) => `<a href="#/${href}" class="${current === key ? "active" : ""}">${label}</a>`;
  let html = link("", "Inicio", "");
  if (state.token && p && !p.banMessage) {
    html += link("cuenta", "Mi cuenta", "cuenta");
    if (p.role === "admin") html += link("admin", "Admin", "admin");
    html += '<button type="button" data-logout>Salir</button>';
  } else {
    html += link("login", "Iniciar sesión", "login") + link("registro", "Registrarse", "registro");
  }
  nav.innerHTML = html;
  nav.querySelector("[data-logout]")?.addEventListener("click", logout);
}

async function logout() {
  try {
    await api("logout");
  } catch {
    // La sesion se borra igual en este navegador.
  }
  setSession(null);
  state.profile = null;
  location.hash = "#/";
  route();
}

function discordNotice() {
  return `
    <div class="notice notice-discord">
      <img src="assets/discord.png" alt="">
      <div class="grow">
        <strong>Te recomendamos unirte al Discord</strong>
        <span class="muted">Ahí avisamos de las novedades del servidor y te ayudamos si algo falla.</span>
      </div>
      <a class="btn btn-discord btn-sm" href="${DISCORD_URL}" target="_blank" rel="noopener">Unirme</a>
    </div>`;
}

function deadlineText(config) {
  return new Date(config.deadline).toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "numeric", month: "long" });
}

/** El 18 de diciembre es el ultimo dia: la fecha limite guardada es el primer instante del dia siguiente. */
function lastDayText(config) {
  return new Date(new Date(config.deadline).getTime() - 1).toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "numeric", month: "long" });
}

function priceNotice(config) {
  const late = config.priceNow > config.priceRegular;
  return late
    ? `<div class="notice notice-amber"><div class="grow"><strong>El precio ahora es ${soles(config.priceLate)}</strong><span class="muted">El precio de ${soles(config.priceRegular)} fue hasta el ${esc(lastDayText(config))}.</span></div></div>`
    : `<div class="notice notice-amber"><div class="grow"><strong>${soles(config.priceRegular)} hasta el ${esc(lastDayText(config))}</strong><span class="muted">Desde el ${esc(deadlineText(config))} el acceso cuesta ${soles(config.priceLate)}.</span></div></div>`;
}

// ---------- Inicio ----------

async function home() {
  const config = state.config || DEFAULT_CONFIG;
  if (!state.config) loadConfig().then((c) => c.priceNow !== config.priceNow && location.hash.replace(/^#\/?/, "") === "" && home());
  const logged = state.token && state.profile && !state.profile.banMessage;
  app.innerHTML = "";
  app.appendChild(h(`
    <section class="hero">
      <div>
        <img class="hero-logo" src="assets/logo-semencraft.png" alt="Semencraft III">
        <h1>Tu cuenta para Semencraft III</h1>
        <p class="lead">Regístrate con tu nombre de Minecraft, envía tu pago por Yape y, en cuanto lo confirmemos, entras al servidor con el launcher.</p>
        <div class="hero-actions">
          ${logged
            ? '<a class="btn btn-primary" href="#/cuenta">Ir a mi cuenta</a>'
            : '<a class="btn btn-primary" href="#/registro">Crear cuenta</a><a class="btn btn-secondary" href="#/login">Ya tengo cuenta</a>'}
        </div>
      </div>
      <div class="stack">
        <div class="steps">
          <div class="step"><span class="step-num">1</span><div><h3>Crea tu cuenta</h3><p class="muted">Con el mismo nombre que usas en Minecraft.</p></div></div>
          <div class="step"><span class="step-num">2</span><div><h3>Paga por Yape</h3><div class="price-line"><span class="price">${soles(config.priceNow)}</span><span class="muted">al ${esc(config.yapeNumber)}</span></div></div></div>
          <div class="step"><span class="step-num">3</span><div><h3>Sube la captura</h3><p class="muted">La revisamos y activamos tu acceso al launcher.</p></div></div>
        </div>
        ${priceNotice(config)}
        ${discordNotice()}
      </div>
    </section>`));
}

// ---------- Login y registro ----------

function authCard(inner) {
  return `<section class="auth-card"><div class="auth-form">${inner}</div><div class="auth-art" aria-hidden="true"></div></section>`;
}

async function login() {
  if (state.token && state.profile && !state.profile.banMessage) {
    location.hash = "#/cuenta";
    return;
  }
  app.innerHTML = "";
  app.appendChild(h(authCard(`
    <img class="auth-logo" src="assets/logo-semencraft.png" alt="Semencraft III">
    <form class="stack" id="form" novalidate>
      <div class="icon-field">${ICON.user}<input class="input" name="username" autocomplete="username" placeholder="Usuario de Minecraft" required></div>
      <div class="icon-field">${ICON.lock}<input class="input" name="password" type="password" autocomplete="current-password" placeholder="Contraseña" required></div>
      <p class="error-text" id="error"></p>
      <button class="btn btn-primary btn-block" type="submit">Entrar</button>
      <p class="auth-switch">¿No tienes cuenta? <a href="#/registro">Regístrate</a></p>
      <p class="faint" style="text-align:center">¿Olvidaste tu contraseña? Pídele a un admin que te la cambie en Discord.</p>
    </form>`)));
  const form = document.getElementById("form");
  form.username.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector("button[type=submit]");
    const error = document.getElementById("error");
    error.textContent = "";
    button.disabled = true;
    try {
      const data = await api("login", { username: form.username.value.trim(), password: form.password.value, client: "web" });
      setSession(data.token);
      state.profile = data.profile;
      location.hash = data.profile.role === "admin" ? "#/admin" : "#/cuenta";
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  };
}

async function register() {
  await loadConfig();
  app.innerHTML = "";
  app.appendChild(h(authCard(`
    <img class="auth-logo" src="assets/logo-semencraft.png" alt="Semencraft III">
    <form class="stack" id="form" novalidate>
      <div class="icon-field">${ICON.user}<input class="input" name="username" autocomplete="username" placeholder="Nombre de Minecraft" maxlength="16" required></div>
      <p class="hint">De 5 a 16 caracteres: letras, números o guion bajo. Es el nombre con el que entrarás al servidor.</p>
      <div class="icon-field">${ICON.lock}<input class="input" name="password" type="password" autocomplete="new-password" placeholder="Contraseña" required></div>
      <div class="icon-field">${ICON.lock}<input class="input" name="repeat" type="password" autocomplete="new-password" placeholder="Repite la contraseña" required></div>
      <p class="error-text" id="error"></p>
      <button class="btn btn-primary btn-block" type="submit">Crear cuenta</button>
      <p class="auth-switch">¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a></p>
    </form>`)));
  const form = document.getElementById("form");
  form.username.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const error = document.getElementById("error");
    const button = form.querySelector("button[type=submit]");
    error.textContent = "";
    const username = form.username.value.trim();
    if (!/^[A-Za-z0-9_]{5,16}$/.test(username)) return (error.textContent = "El nombre debe tener entre 5 y 16 caracteres: letras, números o _.");
    if (form.password.value.length < 6) return (error.textContent = "La contraseña debe tener al menos 6 caracteres.");
    if (form.password.value !== form.repeat.value) return (error.textContent = "Las contraseñas no coinciden.");
    button.disabled = true;
    try {
      const data = await api("register", { username, password: form.password.value });
      setSession(data.token);
      state.profile = data.profile;
      toast("Cuenta creada. Ahora envía tu pago.");
      location.hash = "#/cuenta";
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  };
}

// ---------- Mi cuenta ----------

async function account() {
  if (!state.token) {
    location.hash = "#/login";
    return;
  }
  const [config, profile] = await Promise.all([loadConfig(), loadProfile()]);
  renderNav("cuenta");
  if (!profile) {
    location.hash = "#/login";
    return;
  }
  app.innerHTML = "";
  if (profile.banMessage) {
    app.appendChild(h(`<div class="card stack"><h1>Cuenta baneada</h1><div class="notice notice-red"><div class="grow">${esc(profile.banMessage)}</div></div>${discordNotice()}</div>`));
    return;
  }
  const payments = profile.payments || [];
  const pending = payments.find((p) => p.status === "pending");
  const approved = payments.find((p) => p.status === "approved");
  const rejected = !pending && payments[0]?.status === "rejected" ? payments[0] : null;
  const granted = profile.access === "granted";
  const stage = granted ? 3 : pending ? 2 : 1;

  let main;
  if (profile.access === "revoked") {
    main = `<div class="notice notice-red"><div class="grow"><strong>Tu acceso fue retirado</strong><span class="muted">Habla con un admin en Discord si crees que es un error.</span></div></div>`;
  } else if (granted) {
    main = `
      <div class="notice notice-green"><div class="grow"><strong>Tu cuenta está activa</strong><span class="muted">Descarga el launcher y entra con tu usuario y contraseña.</span></div></div>
      <div class="row"><a class="btn btn-primary" href="${LAUNCHER_URL}" target="_blank" rel="noopener" data-download>Descargar launcher</a><span class="faint" data-download-info></span></div>`;
  } else if (pending) {
    main = `
      <div class="notice notice-amber"><div class="grow"><strong>Estamos revisando tu pago</strong><span class="muted">Enviaste tu comprobante ${esc(ago(pending.created_at))}. Te activamos en cuanto lo confirmemos; suele ser el mismo día.</span></div></div>`;
  } else {
    main = paymentForm(config, rejected);
  }

  app.appendChild(h(`
    <div class="account">
      <div class="card stack">
        <div class="row"><h1>Hola, ${esc(profile.username)}</h1>${profile.isTest ? '<span class="badge badge-violet">Prueba</span>' : ""}</div>
        <div class="progress">
          <div class="seg done"><div class="bar"></div><span>Cuenta creada</span></div>
          <div class="seg ${stage > 1 ? "done" : "now"}"><div class="bar"></div><span>Pago enviado</span></div>
          <div class="seg ${stage > 2 ? "done" : stage === 2 ? "now" : ""}"><div class="bar"></div><span>Acceso activo</span></div>
        </div>
        ${main}
      </div>
      <aside class="stack">
        <div class="card stack">
          <h3>Tu cuenta</h3>
          <dl class="facts">
            <dt>Usuario</dt><dd>${esc(profile.username)}</dd>
            <dt>Estado</dt><dd>${accessBadge(profile)}</dd>
            <dt>Pago</dt><dd>${paymentBadge(approved ? "approved" : pending ? "pending" : rejected ? "rejected" : "none")}</dd>
            <dt>Creada</dt><dd>${esc(date(profile.createdAt, false))}</dd>
          </dl>
          <button class="btn btn-secondary btn-sm" id="change-password">Cambiar contraseña</button>
        </div>
        ${payments.length ? `<div class="card stack"><h3>Tus pagos</h3><div class="history">${payments.map((p) => `
          <div class="history-item"><span>${soles(p.amount_soles)} · ${esc(date(p.created_at, false))}</span>${paymentBadge(p.status)}</div>`).join("")}</div></div>` : ""}
        ${discordNotice()}
      </aside>
    </div>`));

  document.getElementById("change-password").onclick = changePasswordModal;
  bindDownloadButtons(app);
  if (!granted && !pending && profile.access !== "revoked") bindPaymentForm();
}

function paymentForm(config, rejected) {
  return `
    ${rejected ? `<div class="notice notice-red"><div class="grow"><strong>Tu comprobante anterior fue rechazado</strong><span class="muted">${esc(rejected.review_note || "Revisa que la captura muestre el monto y la fecha, y vuelve a enviarla.")}</span></div></div>` : ""}
    <h2>Envía tu pago</h2>
    <div class="yape">
      <img src="assets/yape.png" alt="Yape">
      <div class="stack" style="gap:6px">
        <span class="faint">Yapea <b style="color:var(--text)">${soles(config.priceNow)}</b> al número</span>
        <div class="row"><span class="yape-number">${esc(config.yapeNumber)}</span><button class="copy" type="button" data-copy="${esc(config.yapeNumber.replace(/\s/g, ""))}">Copiar</button></div>
        <span class="faint">Después sube aquí la captura de la operación.</span>
      </div>
    </div>
    ${priceNotice(config)}
    <form class="stack" id="pay-form" novalidate>
      <label class="drop" id="drop">
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp">
        <div id="drop-content" class="stack" style="align-items:center;gap:6px">${ICON.upload}<b>Sube la captura del Yape</b><span class="faint">PNG, JPG o WEBP, hasta 6 MB. También puedes arrastrarla aquí.</span></div>
      </label>
      <div class="field"><label for="op">Número de operación (opcional)</label><input class="input" id="op" name="operationCode" maxlength="32" placeholder="Aparece en la captura del Yape"></div>
      <div class="field"><label for="note">Comentario (opcional)</label><textarea id="note" name="note" maxlength="300" placeholder="Por ejemplo: pagué desde el Yape de mi mamá"></textarea></div>
      <p class="error-text" id="pay-error"></p>
      <button class="btn btn-primary" type="submit">Enviar comprobante</button>
    </form>`;
}

function bindPaymentForm() {
  const form = document.getElementById("pay-form");
  const drop = document.getElementById("drop");
  const content = document.getElementById("drop-content");
  let image = "";
  document.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.copy).then(() => toast("Número copiado."))));

  const pick = (file) => {
    const error = document.getElementById("pay-error");
    error.textContent = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return (error.textContent = "La captura tiene que ser PNG, JPG o WEBP.");
    if (file.size > 6 * 1024 * 1024) return (error.textContent = "La imagen pesa más de 6 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      image = reader.result;
      content.innerHTML = `<img class="preview" src="${image}" alt="Captura seleccionada"><span class="faint">${esc(file.name)} · toca para cambiarla</span>`;
    };
    reader.readAsDataURL(file);
  };
  form.image.onchange = () => pick(form.image.files[0]);
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const error = document.getElementById("pay-error");
    const button = form.querySelector("button[type=submit]");
    if (!image) return (error.textContent = "Adjunta la captura de tu pago.");
    button.disabled = true;
    button.textContent = "Enviando...";
    try {
      await api("submitPayment", { image, operationCode: form.operationCode.value, note: form.note.value });
      toast("Comprobante enviado. Te avisamos al activarte.");
      account();
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
      button.textContent = "Enviar comprobante";
    }
  };
}

function changePasswordModal() {
  modal(`
    <form class="modal" id="pw-form">
      <h2>Cambiar contraseña</h2>
      <div class="field"><label>Contraseña actual</label><input class="input" type="password" name="current" autocomplete="current-password" required></div>
      <div class="field"><label>Nueva contraseña</label><input class="input" type="password" name="next" autocomplete="new-password" required></div>
      <div class="field"><label>Repite la nueva</label><input class="input" type="password" name="repeat" autocomplete="new-password" required></div>
      <p class="error-text" id="pw-error"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`, (layer, close) => {
    const form = layer.querySelector("#pw-form");
    form.current.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const error = layer.querySelector("#pw-error");
      if (form.next.value !== form.repeat.value) return (error.textContent = "Las contraseñas no coinciden.");
      try {
        await api("changePassword", { currentPassword: form.current.value, newPassword: form.next.value });
        close();
        toast("Contraseña cambiada. Se cerraron tus otras sesiones.");
      } catch (err) {
        error.textContent = err.message;
      }
    };
  });
}

// ---------- Panel de admins ----------

async function admin() {
  if (!state.token) {
    location.hash = "#/login";
    return;
  }
  const profile = await loadProfile();
  renderNav("admin");
  if (!profile || profile.role !== "admin") {
    app.innerHTML = "";
    app.appendChild(h('<div class="card"><h2>Solo para admins</h2><p class="muted">Tu cuenta no tiene permisos de admin.</p></div>'));
    return;
  }
  const overview = await api("adminOverview");
  state.config = overview.config;
  const s = overview.stats;
  app.innerHTML = "";
  app.appendChild(h(`
    <div class="admin-head"><h1>Panel de admins</h1><span class="spacer"></span><button class="btn btn-secondary btn-sm" id="refresh">Actualizar</button></div>
    <div class="stats">
      <div class="stat"><b>${s.users}</b><span>Cuentas</span></div>
      <div class="stat"><b>${s.granted}</b><span>Con acceso</span></div>
      <div class="stat"><b>${s.pending}</b><span>Pendientes</span></div>
      <div class="stat"><b>${s.paymentsPending}</b><span>Pagos por revisar</span></div>
      <div class="stat"><b>${s.banned}</b><span>Baneados</span></div>
      <div class="stat"><b>${soles(s.collected)}</b><span>Recaudado</span></div>
    </div>
    <div style="height:18px"></div>
    <div class="tabs" role="tablist">
      <button class="tab" data-tab="payments">Comprobantes${s.paymentsPending ? `<span class="count">${s.paymentsPending}</span>` : ""}</button>
      <button class="tab" data-tab="users">Cuentas</button>
      <button class="tab" data-tab="tests">Cuentas de prueba${s.tests ? `<span class="count">${s.tests}</span>` : ""}</button>
      <button class="tab" data-tab="audit">Historial</button>
    </div>
    <div id="admin-body"></div>`));
  document.getElementById("refresh").onclick = admin;
  document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => openTab(b.dataset.tab)));
  openTab(state.admin.tab);
}

function openTab(tab) {
  state.admin.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const body = document.getElementById("admin-body");
  body.innerHTML = '<div class="sc-wait"><div class="sc-wait-ring"></div></div>';
  ({ payments: paymentsTab, users: usersTab, tests: testsTab, audit: auditTab })[tab](body).catch((error) => {
    body.innerHTML = "";
    body.appendChild(h(`<div class="notice notice-red"><div class="grow">${esc(error.message)}</div></div>`));
  });
}

async function paymentsTab(body) {
  const status = state.admin.paymentStatus;
  const { payments } = await api("adminPayments", { status });
  body.innerHTML = "";
  body.appendChild(h(`
    <div class="toolbar">
      <select id="pay-status">
        <option value="pending">Por revisar</option>
        <option value="approved">Aprobados</option>
        <option value="rejected">Rechazados</option>
        <option value="all">Todos</option>
      </select>
    </div>
    ${payments.length === 0 ? `<div class="card empty">${status === "pending" ? "No hay comprobantes por revisar." : "No hay comprobantes."}</div>` : `
    <div class="proofs">${payments.map((p) => `
      <article class="proof">
        <div class="proof-img" data-zoom="${esc(p.proofUrl || "")}">
          ${p.proofUrl ? `<img src="${esc(p.proofUrl)}" alt="Captura de ${esc(p.app_users?.minecraft_username)}" loading="lazy">` : `<span class="faint">${p.method === "manual" ? "Marcado como pagado sin captura" : "Sin captura"}</span>`}
        </div>
        <div class="proof-body">
          <div class="row"><b>${esc(p.app_users?.minecraft_username || "Cuenta borrada")}</b>${p.app_users?.is_test ? '<span class="badge badge-violet">Prueba</span>' : ""}<span class="spacer"></span>${paymentBadge(p.status)}</div>
          <span class="faint">${soles(p.amount_soles)} · ${esc(date(p.created_at))}${p.operation_code ? ` · Op. ${esc(p.operation_code)}` : ""}</span>
          ${p.note ? `<p class="muted" style="font-size:14px">“${esc(p.note)}”</p>` : ""}
          ${p.review_note && p.status !== "pending" ? `<p class="faint">Nota: ${esc(p.review_note)}</p>` : ""}
          ${p.status === "pending" ? `<div class="row"><button class="btn btn-ok btn-sm" data-approve="${p.id}">Aprobar y dar acceso</button><button class="btn btn-danger btn-sm" data-reject="${p.id}">Rechazar</button></div>` : ""}
        </div>
      </article>`).join("")}</div>`}`));
  const select = body.querySelector("#pay-status");
  select.value = status;
  select.onchange = () => {
    state.admin.paymentStatus = select.value;
    openTab("payments");
  };
  body.querySelectorAll("[data-zoom]").forEach((el) => el.dataset.zoom && (el.onclick = () => modal(`<div class="modal modal-image" data-close><img src="${esc(el.dataset.zoom)}" alt=""></div>`)));
  body.querySelectorAll("[data-approve]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try {
      await api("adminReviewPayment", { paymentId: b.dataset.approve, approve: true });
      toast("Pago aprobado: la cuenta ya tiene acceso.");
      admin();
    } catch (err) {
      toast(err.message, "error");
      b.disabled = false;
    }
  }));
  body.querySelectorAll("[data-reject]").forEach((b) => (b.onclick = () => askText("Rechazar comprobante", "Cuéntale al jugador por qué (lo verá en su cuenta).", "Rechazar", true, async (note) => {
    await api("adminReviewPayment", { paymentId: b.dataset.reject, approve: false, note });
    toast("Comprobante rechazado.");
    admin();
  })));
}

async function usersTab(body) {
  const { users } = await api("adminListUsers");
  state.admin.users = users.filter((u) => !u.isTest);
  body.innerHTML = "";
  body.appendChild(h(`
    <div class="toolbar">
      <input class="input" id="search" placeholder="Buscar por nombre o Discord" value="${esc(state.admin.search)}">
      <select id="filter">
        <option value="all">Todas</option>
        <option value="pending">Pendientes</option>
        <option value="granted">Con acceso</option>
        <option value="revoked">Acceso retirado</option>
        <option value="banned">Baneadas</option>
        <option value="unpaid">Con acceso sin pago registrado</option>
        <option value="admin">Admins</option>
      </select>
      <span class="spacer"></span>
      <button class="btn btn-secondary btn-sm" id="new-user">Crear cuenta</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Jugador</th><th>Estado</th><th>Pago</th><th>Equipo</th><th>Registro</th><th>Última vez</th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>`));
  const search = body.querySelector("#search");
  const filter = body.querySelector("#filter");
  filter.value = state.admin.filter;
  const draw = () => {
    state.admin.search = search.value;
    state.admin.filter = filter.value;
    const q = search.value.trim().toLowerCase();
    const rows = state.admin.users.filter((u) => {
      if (q && !u.username.toLowerCase().includes(q) && !(u.discord || "").toLowerCase().includes(q)) return false;
      switch (filter.value) {
        case "pending": return u.access === "pending" && !u.banned;
        case "granted": return u.access === "granted" && !u.banned;
        case "revoked": return u.access === "revoked";
        case "banned": return u.banned;
        case "unpaid": return u.access === "granted" && u.paymentStatus !== "approved";
        case "admin": return u.role === "admin";
        default: return true;
      }
    });
    const tbody = body.querySelector("#rows");
    tbody.innerHTML = rows.length ? "" : '<tr><td colspan="6" class="empty">No hay cuentas con ese filtro.</td></tr>';
    for (const u of rows) {
      const tr = h(`<tr data-id="${u.id}">
        <td><div class="player"><span data-head></span>${esc(u.username)}${u.role === "admin" ? '<span class="badge badge-violet">Admin</span>' : ""}</div></td>
        <td>${accessBadge(u)}</td>
        <td>${paymentBadge(u.paymentStatus)}</td>
        <td>${esc(u.teamName || "—")}</td>
        <td><span class="badge">${{ web: "Web", discord: "Discord", admin: "Admin" }[u.registeredVia] || esc(u.registeredVia)}</span></td>
        <td class="faint">${esc(ago(u.lastSeenAt))}</td>
      </tr>`).firstElementChild;
      tr.querySelector("[data-head]").replaceWith(headImg(u.username));
      tr.onclick = () => openUser(u.id);
      tbody.appendChild(tr);
    }
  };
  search.oninput = draw;
  filter.onchange = draw;
  body.querySelector("#new-user").onclick = createUserModal;
  draw();
}

function createUserModal() {
  modal(`
    <form class="modal" id="cu-form">
      <h2>Crear cuenta</h2>
      <p class="muted">Para alguien que no puede registrarse solo. Se genera una contraseña que verás una sola vez.</p>
      <div class="field"><label>Nombre de Minecraft</label><input class="input" name="username" maxlength="16" required></div>
      <label class="check"><input type="checkbox" name="granted" checked> Darle acceso al launcher</label>
      <label class="check"><input type="checkbox" name="paid"> Marcar como pagado</label>
      <div class="field"><label>Nota interna (opcional)</label><input class="input" name="note" maxlength="200"></div>
      <p class="error-text" id="cu-error"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Crear</button></div>
    </form>`, (layer, close) => {
    const form = layer.querySelector("#cu-form");
    form.username.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const data = await api("adminCreateUser", { username: form.username.value.trim(), access: form.granted.checked ? "granted" : "pending", note: form.note.value });
        if (form.paid.checked) await api("adminMarkPaid", { userId: data.user.id });
        close();
        secretModal("Cuenta creada", `Pásale estos datos a ${data.user.username}. Puede cambiar la contraseña desde su cuenta.`, `${data.user.username} / ${data.password}`);
        openTab("users");
      } catch (err) {
        layer.querySelector("#cu-error").textContent = err.message;
      }
    };
  });
}

function closeDrawer() {
  document.querySelector(".drawer-shade")?.remove();
  document.querySelector(".drawer")?.remove();
}

async function openUser(userId) {
  closeDrawer();
  document.body.appendChild(h('<div class="drawer-shade"></div><aside class="drawer"><div class="sc-wait"><div class="sc-wait-ring"></div></div></aside>'));
  document.querySelector(".drawer-shade").onclick = closeDrawer;
  const drawer = document.querySelector(".drawer");
  try {
    const data = await api("adminUser", { userId });
    renderUser(drawer, data);
  } catch (err) {
    drawer.innerHTML = `<p class="error-text">${esc(err.message)}</p>`;
  }
}

function renderUser(drawer, { user: u, team, sessions, payments, audit }) {
  const me = state.profile;
  const self = u.id === me.id;
  const otherAdmin = u.role === "admin" && !self;
  const paid = payments.some((p) => p.status === "approved");
  drawer.innerHTML = "";
  drawer.appendChild(h(`
    <div class="row"><span class="spacer"></span><button class="btn btn-ghost btn-sm" data-x>Cerrar</button></div>
    <h2><span data-head></span>${esc(u.username)}</h2>
    <div class="row">${accessBadge(u)}${paymentBadge(paid ? "approved" : payments[0]?.status || "none")}${u.role === "admin" ? '<span class="badge badge-violet">Admin</span>' : ""}${u.isTest ? '<span class="badge badge-violet">Prueba</span>' : ""}</div>
    ${u.banned ? `<div class="notice notice-red"><div class="grow"><strong>Baneado${u.bannedUntil ? " hasta el " + esc(date(u.bannedUntil)) : " sin fecha de fin"}</strong><span>${esc(u.banReason || "")}</span></div></div>` : ""}
    <dl class="facts">
      <dt>Discord</dt><dd>${esc(u.discord || "Sin vincular")}</dd>
      <dt>Equipo</dt><dd>${team ? esc(team.team_name) + (team.founder ? " (fundador)" : "") : "—"}</dd>
      <dt>Registro</dt><dd>${esc(date(u.createdAt))} · ${{ web: "web", discord: "launcher con Discord", admin: "creada por un admin" }[u.registeredVia] || esc(u.registeredVia)}</dd>
      <dt>Última vez</dt><dd>${esc(ago(u.lastSeenAt))}</dd>
      <dt>Sesiones</dt><dd>${sessions} abierta${sessions === 1 ? "" : "s"}</dd>
      ${u.isTest ? `<dt>Se borra</dt><dd>${esc(date(u.expiresAt))}</dd>` : ""}
    </dl>

    <span class="section-title">Acceso</span>
    <div class="actions">
      ${u.access !== "granted" ? '<button class="btn btn-ok btn-sm" data-act="grant">Dar acceso</button>' : ""}
      ${u.access === "granted" && !self && !otherAdmin ? '<button class="btn btn-secondary btn-sm" data-act="revoke">Quitar acceso</button>' : ""}
      ${!paid ? '<button class="btn btn-ok btn-sm" data-act="paid">Marcar como pagado</button>' : ""}
      ${!u.banned && !self && !otherAdmin ? '<button class="btn btn-danger btn-sm" data-act="ban">Banear</button>' : ""}
      ${u.banned ? '<button class="btn btn-ok btn-sm" data-act="unban">Quitar baneo</button>' : ""}
    </div>

    <span class="section-title">Cuenta</span>
    <div class="actions">
      ${!self && !otherAdmin ? '<button class="btn btn-secondary btn-sm" data-act="password">Nueva contraseña</button>' : ""}
      <button class="btn btn-secondary btn-sm" data-act="logout">Cerrar sesiones</button>
      ${team ? '<button class="btn btn-secondary btn-sm" data-act="team">Sacar del equipo</button>' : ""}
      ${!u.isTest && u.role !== "admin" ? '<button class="btn btn-secondary btn-sm" data-act="make-admin">Hacer admin</button>' : ""}
      ${otherAdmin ? '<button class="btn btn-secondary btn-sm" data-act="remove-admin">Quitar admin</button>' : ""}
      ${!self && !otherAdmin ? '<button class="btn btn-danger btn-sm" data-act="delete">Borrar cuenta</button>' : ""}
    </div>

    <span class="section-title">Nota interna</span>
    <div class="stack" style="gap:8px">
      <textarea class="input" id="note" maxlength="1000" placeholder="Solo la ven los admins">${esc(u.note || "")}</textarea>
      <div class="row"><button class="btn btn-secondary btn-sm" data-act="note">Guardar nota</button></div>
    </div>

    <span class="section-title">Pagos</span>
    ${payments.length ? `<div class="history">${payments.map((p) => `
      <div class="history-item">
        <span>${soles(p.amount_soles)} · ${esc(date(p.created_at, false))}${p.method === "manual" ? " · sin captura" : ""}</span>
        <span class="row" style="gap:8px">${p.proofUrl ? `<a href="${esc(p.proofUrl)}" target="_blank" rel="noopener">Ver captura</a>` : ""}${paymentBadge(p.status)}</span>
      </div>`).join("")}</div>` : '<p class="faint">No hay pagos registrados.</p>'}

    ${audit.length ? `<span class="section-title">Historial de la cuenta</span>
    <div class="history">${audit.map((a) => `<div class="history-item"><span>${esc(describeAction(a.action, a.details))}</span><span class="faint">${esc(a.admin_name)} · ${esc(ago(a.created_at))}</span></div>`).join("")}</div>` : ""}`));
  drawer.querySelector("[data-head]").replaceWith(headImg(u.username));
  drawer.querySelector("[data-x]").onclick = closeDrawer;

  const run = async (action, body, message) => {
    try {
      const result = await api(action, { userId: u.id, ...body });
      if (message) toast(message);
      openUser(u.id);
      refreshAdminInBackground();
      return result;
    } catch (err) {
      toast(err.message, "error");
      return null;
    }
  };
  const handlers = {
    grant: () => run("adminSetAccess", { access: "granted" }, "Acceso concedido."),
    revoke: async () => (await confirmModal("Quitar acceso", `${u.username} ya no podrá entrar con el launcher.`, "Quitar acceso", true)) && run("adminSetAccess", { access: "revoked" }, "Acceso retirado."),
    paid: () => askText("Marcar como pagado", `Se registra el pago de ${u.username} sin captura y se le da acceso.`, "Marcar como pagado", false, (note) => run("adminMarkPaid", { note }, "Marcado como pagado."), "Nota (opcional): efectivo, Yape sin captura..."),
    ban: () => banModal(u, run),
    unban: () => run("adminUnban", {}, "Baneo quitado."),
    password: async () => {
      if (!(await confirmModal("Nueva contraseña", `Se genera una contraseña nueva para ${u.username} y se cierran sus sesiones.`, "Generar"))) return;
      const r = await run("adminResetPassword", {});
      if (r) secretModal("Contraseña nueva", `Pásale esta contraseña a ${u.username}. Solo la verás ahora.`, r.password);
    },
    logout: () => run("adminLogoutUser", {}, "Sesiones cerradas."),
    team: async () => (await confirmModal("Sacar del equipo", team?.founder ? "Era el fundador: el mando pasa al miembro más antiguo." : `${u.username} sale de ${team?.team_name}.`, "Sacar")) && run("adminRemoveFromTeam", {}, "Fuera del equipo."),
    "make-admin": async () => (await confirmModal("Hacer admin", `${u.username} podrá ver y cambiar todas las cuentas.`, "Hacer admin")) && run("adminSetRole", { role: "admin" }, "Ahora es admin."),
    "remove-admin": async () => (await confirmModal("Quitar admin", `${u.username} pasa a ser jugador normal.`, "Quitar admin", true)) && run("adminSetRole", { role: "player" }, "Ya no es admin."),
    note: () => run("adminSetNote", { note: drawer.querySelector("#note").value }, "Nota guardada."),
    delete: () => deleteModal(u),
  };
  drawer.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => handlers[b.dataset.act]()));
}

function refreshAdminInBackground() {
  if (location.hash.startsWith("#/admin") && state.admin.tab) {
    const body = document.getElementById("admin-body");
    if (body) ({ payments: paymentsTab, users: usersTab, tests: testsTab, audit: auditTab })[state.admin.tab](body).catch(() => {});
  }
}

function askText(title, text, confirmLabel, danger, onConfirm, placeholder = "") {
  modal(`
    <form class="modal" id="ask-form">
      <h2>${esc(title)}</h2>
      <p class="muted">${esc(text)}</p>
      <textarea class="input" name="text" maxlength="300" placeholder="${esc(placeholder)}"></textarea>
      <p class="error-text" id="ask-error"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="submit">${esc(confirmLabel)}</button></div>
    </form>`, (layer, close) => {
    const form = layer.querySelector("#ask-form");
    form.text.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await onConfirm(form.text.value.trim());
        close();
      } catch (err) {
        layer.querySelector("#ask-error").textContent = err.message;
      }
    };
  });
}

function banModal(u, run) {
  modal(`
    <form class="modal" id="ban-form">
      <h2>Banear a ${esc(u.username)}</h2>
      <div class="field"><label>Motivo</label><textarea class="input" name="reason" maxlength="300" placeholder="Lo verá al intentar entrar" required></textarea></div>
      <div class="field"><label>Duración</label>
        <select name="hours">
          <option value="1">1 hora</option>
          <option value="24">1 día</option>
          <option value="72">3 días</option>
          <option value="168">1 semana</option>
          <option value="720">30 días</option>
          <option value="0" selected>Permanente</option>
        </select>
      </div>
      <p class="hint">Se cierran sus sesiones y no podrá entrar ni al launcher ni a la web.</p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" type="submit">Banear</button></div>
    </form>`, (layer, close) => {
    const form = layer.querySelector("#ban-form");
    form.reason.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      close();
      await run("adminBan", { reason: form.reason.value, hours: Number(form.hours.value) }, "Cuenta baneada.");
    };
  });
}

function deleteModal(u) {
  modal(`
    <form class="modal" id="del-form">
      <h2>Borrar ${esc(u.username)}</h2>
      <p class="muted">Se borran la cuenta, sus pagos y sus capturas. No se puede deshacer.</p>
      <div class="field"><label>Escribe <b>${esc(u.username)}</b> para confirmar</label><input class="input" name="confirm" autocomplete="off"></div>
      <p class="error-text" id="del-error"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" type="submit">Borrar para siempre</button></div>
    </form>`, (layer, close) => {
    const form = layer.querySelector("#del-form");
    form.confirm.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("adminDeleteUser", { userId: u.id, confirm: form.confirm.value.trim() });
        close();
        closeDrawer();
        toast("Cuenta borrada.");
        admin();
      } catch (err) {
        layer.querySelector("#del-error").textContent = err.message;
      }
    };
  });
}

async function testsTab(body) {
  const { users } = await api("adminListUsers");
  const tests = users.filter((u) => u.isTest);
  body.innerHTML = "";
  body.appendChild(h(`
    <div class="grid-2">
      <div class="card stack">
        <h3>Crear cuenta de prueba</h3>
        <p class="muted">Sirven para probar el panel sin tocar cuentas reales. Se borran solas a los 20 minutos.</p>
        <label class="check"><input type="checkbox" id="t-pay" checked> Con un comprobante de pago de prueba</label>
        <label class="check"><input type="checkbox" id="t-access"> Con acceso al launcher desde el inicio</label>
        <button class="btn btn-primary" id="t-create">Crear cuenta de prueba</button>
      </div>
      <div class="card stack">
        <div class="row"><h3>Activas</h3><span class="spacer"></span>${tests.length ? '<button class="btn btn-danger btn-sm" id="t-clear">Borrar todas</button>' : ""}</div>
        ${tests.length ? `<div class="history">${tests.map((t) => `
          <div class="history-item" style="cursor:pointer" data-id="${t.id}"><span class="row" style="gap:8px"><b>${esc(t.username)}</b>${accessBadge(t)}</span><span class="faint">se borra ${esc(new Date(t.expiresAt).toLocaleTimeString("es-PE", { timeStyle: "short" }))}</span></div>`).join("")}</div>`
          : '<p class="faint">No hay cuentas de prueba.</p>'}
      </div>
    </div>`));
  body.querySelector("#t-create").onclick = async (e) => {
    e.target.disabled = true;
    try {
      const r = await api("adminCreateTestUser", { withPayment: body.querySelector("#t-pay").checked, access: body.querySelector("#t-access").checked ? "granted" : "pending" });
      secretModal("Cuenta de prueba creada", `Puedes entrar con ella en la web o en el launcher. Se borra sola a las ${new Date(r.expiresAt).toLocaleTimeString("es-PE", { timeStyle: "short" })}`, `${r.user.username} / ${r.password}`);
      admin();
    } catch (err) {
      toast(err.message, "error");
      e.target.disabled = false;
    }
  };
  body.querySelector("#t-clear")?.addEventListener("click", async () => {
    if (!(await confirmModal("Borrar cuentas de prueba", "Se borran todas las cuentas de prueba ahora mismo.", "Borrar todas", true))) return;
    const r = await api("adminDeleteTestUsers");
    toast(`${r.deleted} cuentas de prueba borradas.`);
    admin();
  });
  body.querySelectorAll("[data-id]").forEach((el) => (el.onclick = () => openUser(el.dataset.id)));
}

const ACTION_NAMES = {
  payment_approved: "Aprobó un pago",
  payment_rejected: "Rechazó un pago",
  marked_paid: "Marcó como pagado",
  access_granted: "Dio acceso",
  access_revoked: "Quitó el acceso",
  access_pending: "Dejó el acceso pendiente",
  ban: "Baneó",
  unban: "Quitó el baneo",
  password_reset: "Generó contraseña nueva",
  force_logout: "Cerró las sesiones",
  admin_granted: "Hizo admin",
  admin_removed: "Quitó admin",
  team_removed: "Sacó del equipo",
  note: "Editó la nota",
  user_deleted: "Borró la cuenta",
  user_created: "Creó la cuenta",
  test_user_created: "Creó una cuenta de prueba",
  test_users_deleted: "Borró las cuentas de prueba",
};

function describeAction(action, details = {}) {
  let text = ACTION_NAMES[action] || action;
  if (action === "ban") text += details.until ? ` hasta el ${date(details.until)}` : " para siempre";
  if ((action === "payment_approved" || action === "marked_paid") && details.amount != null) text += ` (${soles(details.amount)})`;
  if (action === "test_users_deleted") text += ` (${details.count ?? 0})`;
  return text;
}

async function auditTab(body) {
  const { entries } = await api("adminAudit");
  body.innerHTML = "";
  body.appendChild(h(entries.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Cuándo</th><th>Admin</th><th>Acción</th><th>Cuenta</th></tr></thead>
      <tbody>${entries.map((e) => `<tr style="cursor:default"><td class="faint">${esc(date(e.created_at))}</td><td>${esc(e.admin_name)}</td><td>${esc(describeAction(e.action, e.details))}${e.details?.reason ? `: ${esc(e.details.reason)}` : ""}</td><td>${esc(e.target_name || "—")}</td></tr>`).join("")}</tbody>
    </table></div>` : '<div class="card empty">Todavía no hay acciones de admins.</div>'));
}

// ---------- Inicio de la pagina ----------

window.addEventListener("hashchange", route);
(async () => {
  bindDownloadButtons(document.querySelector(".footer"));
  if (state.token) await loadProfile();
  route();
})();
