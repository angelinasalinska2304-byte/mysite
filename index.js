// ====== НАЛАШТУВАННЯ ======
const GOOGLE_CLIENT_ID = "....";           // OAuth Client ID з Google Cloud Console
const APPLE_CLIENT_ID = "....";            // Services ID з Apple Developer (не App ID!)
const APPLE_REDIRECT_URI = window.location.origin; // має збігатися з Return URL в Apple Developer

// ====== УТИЛІТИ ======
const $ = (id) => document.getElementById(id);

// Декодування JWT (з підтримкою кирилиці/UTF-8)
const parseJWT = (token) => {
  const base64URL = token.split(".")[1];
  const base64 = base64URL.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(json);
};

// ====== ПЕРЕМИКАННЯ ВИДІВ ======
const showProfile = ({ name, email, picture, provider }) => {
  $("authView").hidden = true;
  $("profileView").hidden = false;

  $("name").textContent = name || "Користувач";
  $("email").textContent = email || "";
  $("provider").textContent = `Вхід через ${provider}`;

  const img = $("picture");
  img.src =
    picture ||
    "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' fill='#2a3050'/><text x='48' y='62' font-size='44' text-anchor='middle' fill='#9aa2c0' font-family='sans-serif'>${(name || email || "?")[0].toUpperCase()}</text></svg>`
      );

  sessionStorage.setItem("user", JSON.stringify({ name, email, picture, provider }));
};

const showAuth = () => {
  $("profileView").hidden = true;
  $("authView").hidden = false;
  sessionStorage.removeItem("user");
};

// ====== GOOGLE ======
const handleCredential = (response) => {
  const data = parseJWT(response.credential);
  showProfile({
    name: data.name,
    email: data.email,
    picture: data.picture,
    provider: "Google",
  });
  // TODO: надішліть response.credential на бекенд і перевірте підпис токена
};

window.onGoogleLibraryLoad = () => {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredential,
  });

  google.accounts.id.renderButton($("googleBtn"), {
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    width: 340,
    locale: "uk",
  });

  if (!sessionStorage.getItem("user")) {
    google.accounts.id.prompt();
  }
};

// ====== APPLE ======
let appleReady = false;

const initApple = () => {
  if (appleReady || !window.AppleID) return appleReady;
  AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: "name email",
    redirectURI: APPLE_REDIRECT_URI,
    usePopup: true,
  });
  appleReady = true;
  return true;
};

$("appleBtn").addEventListener("click", async () => {
  if (!initApple()) {
    return showError("Apple SDK ще не завантажився. Спробуйте за секунду.");
  }
  try {
    const res = await AppleID.auth.signIn();
    const data = parseJWT(res.authorization.id_token);

    // Apple віддає ім'я ЛИШЕ при першому вході, і то окремо від токена
    const fullName = res.user
      ? [res.user.name?.firstName, res.user.name?.lastName].filter(Boolean).join(" ")
      : "";

    showProfile({
      name: fullName || data.email?.split("@")[0],
      email: data.email,
      picture: null,
      provider: "Apple",
    });
    // TODO: надішліть res.authorization.id_token / code на бекенд
  } catch (err) {
    // popup_closed_by_user — не помилка для користувача
    if (err?.error !== "popup_closed_by_user") {
      showError("Не вдалося увійти через Apple.");
      console.error(err);
    }
  }
});

// ====== EMAIL / ПАРОЛЬ ======
let mode = "login"; // "login" | "register"

const showError = (msg) => {
  const el = $("formError");
  el.textContent = msg;
  el.hidden = !msg;
};

const setMode = (next) => {
  mode = next;
  const isLogin = next === "login";

  $("tabLogin").classList.toggle("active", isLogin);
  $("tabRegister").classList.toggle("active", !isLogin);

  $("nameField").hidden = isLogin;
  $("confirmField").hidden = isLogin;
  $("loginExtras").hidden = !isLogin;

  $("title").textContent = isLogin ? "З поверненням" : "Створіть акаунт";
  $("subtitle").textContent = isLogin ? "Увійдіть у свій акаунт" : "Реєстрація займе хвилину";
  $("submitBtn").textContent = isLogin ? "Увійти" : "Зареєструватися";
  $("authPassword").autocomplete = isLogin ? "current-password" : "new-password";

  showError("");
  document.querySelectorAll("input.invalid").forEach((i) => i.classList.remove("invalid"));
};

$("tabLogin").addEventListener("click", () => setMode("login"));
$("tabRegister").addEventListener("click", () => setMode("register"));

$("togglePass").addEventListener("click", () => {
  const input = $("authPassword");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("togglePass").setAttribute("aria-label", show ? "Сховати пароль" : "Показати пароль");
});

$("forgot").addEventListener("click", (e) => {
  e.preventDefault();
  // TODO: перехід на сторінку відновлення пароля
  showError("Відновлення пароля поки не підключено.");
});

const validate = () => {
  const name = $("fullName").value.trim();
  const email = $("authEmail").value.trim();
  const pass = $("authPassword").value;
  const confirm = $("confirmPassword").value;

  document.querySelectorAll("input.invalid").forEach((i) => i.classList.remove("invalid"));
  const fail = (id, msg) => {
    $(id).classList.add("invalid");
    showError(msg);
    return null;
  };

  if (mode === "register" && name.length < 2) return fail("fullName", "Введіть ім'я.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("authEmail", "Введіть коректний email.");
  if (pass.length < 8) return fail("authPassword", "Пароль має містити щонайменше 8 символів.");
  if (mode === "register" && pass !== confirm) return fail("confirmPassword", "Паролі не збігаються.");

  showError("");
  return { name, email, pass };
};

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const values = validate();
  if (!values) return;

  const btn = $("submitBtn");
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Зачекайте…";

  try {
    // TODO: замініть на реальний запит до вашого бекенду, наприклад:
    // const res = await fetch(`/api/auth/${mode}`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ name: values.name, email: values.email, password: values.pass }),
    // });
    // if (!res.ok) throw new Error((await res.json()).message);
    // const user = await res.json();
    await new Promise((r) => setTimeout(r, 600)); // імітація запиту

    showProfile({
      name: values.name || values.email.split("@")[0],
      email: values.email,
      picture: null,
      provider: "Email",
    });
  } catch (err) {
    showError(err.message || "Щось пішло не так. Спробуйте ще раз.");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

// ====== ВИХІД ======
$("logoutBtn").addEventListener("click", () => {
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  showAuth();
});

// ====== СТАРТ ======
window.addEventListener("load", () => {
  initApple();
  const saved = sessionStorage.getItem("user");
  if (saved) showProfile(JSON.parse(saved));
});