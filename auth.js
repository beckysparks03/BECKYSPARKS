document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("pw-overlay");
  const form = document.getElementById("pw-form");
  const input = document.getElementById("pw-input");
  const err = document.getElementById("pw-error");

  // CHANGE THIS:
  const PASSWORD = "yourpasswordhere";

  // session-only auth key
  const KEY = "pro_authed_v1";

  if (!overlay || !form || !input || !err) return;

  // If already authed in this tab session, hide overlay
  if (sessionStorage.getItem(KEY) === "1") {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.display = "none";
    return;
  }

  // Show overlay
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  overlay.style.display = "flex";
  input.focus();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (input.value || "").trim();

    if (val === PASSWORD) {
      sessionStorage.setItem(KEY, "1");
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.display = "none";
    } else {
      err.textContent = "Incorrect password.";
      input.value = "";
      input.focus();
    }
  });
});

