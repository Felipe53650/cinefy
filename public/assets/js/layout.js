(function () {
  const body = document.body;
  const currentPage = body.dataset.page || "";
  const store = window.CinefyStore;
  const profile = store ? store.loadProfile() : null;
  const session = (() => {
    try {
      const raw = localStorage.getItem("cinefy-auth-session");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  })();
  const currentSearchQuery = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return String(params.get("q") || "").trim();
    } catch (error) {
      return "";
    }
  })();

  // Removido: redirecionamento forçado para login. Agora permite acesso anônimo.

  // Páginas que exigem login
  const navItems = [
    { key: "home", label: "Inicio", mobileLabel: "Home", href: "index.html", icon: "home" },
    { key: "lista", label: "Minha Lista", mobileLabel: "Lista", href: "lista.html", icon: "movie_filter" },
    { key: "buscar", label: "Buscar Filmes", mobileLabel: "Buscar", href: "busca.html", icon: "search" },
    { key: "amigos", label: "Amigos", mobileLabel: "Amigos", href: "amigos.html", icon: "group" }
  ];

  let notifications = store ? store.loadNotifications() : [];
  let unreadCount = store ? store.getUnreadNotificationCount() : 0;
  const defaultAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuBm2HxOu-EGtKkBUP5RwOS7MwT9dJkKn_7vG4oxQF95I4rUUD0IUB61Lm0FY8S49Y0bEJZbDRec6XyHVVI2wtwYH_Yac791G4SqebfMan9yXRJ3UivuQwzgCwdBZfV8AjzdJvR8j5LLytM3KZHnmCKnmEOrZ0-rvzyHbAHBk71hyUzfZLiQmlLyUxlYWRfQnDaHkVF2KpjNQSbD-cG2NehFuEUFCQThMuDwSpEXw_OnY1VqPbRj-d9qdKH1_QJcw1v3n6wdeP9Dn_q7";

  function buildDesktopLinks() {
    return navItems.filter((item) => item.key !== "buscar").map((item) => {
      const isActive = item.key === currentPage;
      const ariaCurrent = isActive ? ' aria-current="page"' : "";
      return `
        <a class="group relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${isActive ? "text-white" : "text-zinc-200 transition-colors hover:text-white"}" href="${item.href}"${ariaCurrent}>
          <span class="material-symbols-outlined text-[18px] ${isActive ? "text-red-300" : "text-zinc-300 transition-colors group-hover:text-red-300"}">${item.icon}</span>
          <span>${item.label}</span>
          ${isActive ? '<span class="absolute inset-x-3 -bottom-1 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent"></span>' : ""}
        </a>
      `;
    }).join("");
  }

  function buildGlobalSearch() {
    return `
      <form class="cinefy-global-search hidden md:flex" id="globalSearchForm" role="search">
        <label class="sr-only" for="globalSearchInput">Buscar filmes no CINEfy</label>
        <span class="material-symbols-outlined cinefy-global-search__icon">search</span>
        <input class="cinefy-global-search__input" id="globalSearchInput" name="q" placeholder="Buscar filmes..." type="search" value="${escapeAttribute(currentSearchQuery)}"/>
        <button class="cinefy-global-search__button" type="submit">Buscar</button>
      </form>
    `;
  }

  function buildMobileLinks() {
    return navItems.map((item) => {
      const isActive = item.key === currentPage;
      const ariaCurrent = isActive ? ' aria-current="page"' : "";
      return `
        <a class="flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 ${isActive ? "text-white" : "text-zinc-200 transition-colors hover:text-white"}" href="${item.href}"${ariaCurrent}>
          <span class="material-symbols-outlined ${isActive ? "text-red-300" : "text-zinc-300"}">${item.icon}</span>
          <span class="text-[10px] font-semibold">${item.mobileLabel || item.label}</span>
        </a>
      `;
    }).join("");
  }

  function buildNotifications() {
    if (!notifications.length) {
      return `
        <div class="rounded-[1.25rem] border border-white/8 bg-[#241213] p-4 text-sm text-zinc-400">
          Nenhuma notificacao por enquanto.
        </div>
      `;
    }

    return notifications.slice(0, 8).map((notification) => `
      <a class="block rounded-[1.25rem] border ${notification.read ? "border-white/8 bg-[#241213]" : "border-red-500/30 bg-red-950/30"} p-4 transition hover:border-red-500/50 hover:bg-[#2c1718]" href="${resolveNotificationHref(notification.href)}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-white">${escapeHtml(notification.title)}</p>
            <p class="mt-1 text-sm text-zinc-300">${escapeHtml(notification.message)}</p>
          </div>
          ${notification.read ? "" : '<span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>'}
        </div>
        <p class="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-500">${escapeHtml(formatRelative(notification.createdAt))}</p>
      </a>
    `).join("");
  }

  function renderNavbar() {
    return `
      <div class="cinefy-topbar fixed inset-x-0 top-0 z-[80] px-3 pt-3 md:px-6 md:pt-4">
        <div class="cinefy-topbar__inner mx-auto flex h-[4.25rem] w-full max-w-[1440px] items-center justify-between gap-2 rounded-[1.2rem] border border-[#5a2b2d] bg-[#201011] px-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl md:gap-4 md:px-5">
          <div class="flex min-w-0 items-center gap-4 md:gap-8">
            <a class="cinefy-brand min-w-0 text-2xl font-black italic tracking-[-0.08em] text-red-600 transition hover:text-red-500 md:text-[1.9rem]" href="index.html">
              CINEfy
            </a>
            <nav aria-label="Navegacao principal" class="hidden items-center gap-1.5 md:flex">
              ${buildDesktopLinks()}
            </nav>
            ${buildGlobalSearch()}
          </div>
          <div class="cinefy-topbar__actions flex items-center gap-3 md:gap-4">
            ${session ? `
            <div class="relative">
              <button class="cinefy-notifications-button relative rounded-[0.95rem] border border-[#5a2b2d] bg-[#2a1516] p-2.5 transition hover:border-red-500/30 hover:bg-[#341a1b] active:scale-95" id="notificationsButton" type="button" aria-label="Notificacoes">
                <span class="material-symbols-outlined text-zinc-300">notifications</span>
                ${unreadCount ? `<span class="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">${Math.min(unreadCount, 9)}</span>` : ""}
              </button>
              <div aria-hidden="true" class="cinefy-notifications-panel absolute right-0 mt-3 hidden w-[min(24rem,calc(100vw-2rem))] rounded-[1.2rem] border border-[#5a2b2d] bg-[#170c0d] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.62)]" id="notificationsPanel">
                <div class="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p class="text-xs uppercase tracking-[0.24em] text-zinc-500">Central</p>
                    <p class="mt-1 text-lg font-black text-white">Notificacoes</p>
                  </div>
                  <button class="text-sm font-bold text-red-300 transition hover:text-red-200" id="markNotificationsReadButton" type="button">Marcar como lidas</button>
                </div>
                <div class="cinefy-notifications-list space-y-3 max-h-[24rem] overflow-y-auto pr-1">${buildNotifications()}</div>
              </div>
            </div>
            ` : ''}
            ${session ? `
            <a class="cinefy-profile-link flex min-w-0 items-center gap-2 rounded-[999px] border border-[#6c3437] bg-[#2a1516] px-1 py-1 transition hover:border-red-500/30 hover:bg-[#341a1b] md:gap-3 md:py-1.5 md:pl-1.5 md:pr-4" href="perfil.html" aria-label="Perfil">
              <img alt="Avatar do usuario" class="cinefy-profile-avatar h-9 w-9 rounded-full object-cover ring-1 ring-red-400/30" decoding="async" src="${escapeAttribute(safeAvatarUrl(profile ? profile.avatar : defaultAvatar))}" />
              <div class="cinefy-profile-meta hidden min-w-0 md:block">
                <span class="cinefy-profile-name block truncate text-sm font-semibold text-white">${escapeHtml(profile ? profile.displayName : "Perfil")}</span>
                <span class="cinefy-profile-secondary block truncate text-[11px] text-zinc-500">${escapeHtml(profile ? profile.email || `@${profile.username}` : "@cinefy")}</span>
              </div>
            </a>
            ` : `
            <a class="rounded-full bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 md:px-4" href="login.html">Entrar</a>
            `}
          </div>
        </div>
      </div>
      <nav aria-label="Navegacao principal mobile" class="cinefy-mobile-nav fixed bottom-2 left-2 right-2 z-50 flex justify-around rounded-[1rem] border border-[#5a2b2d] bg-[#201011] py-2.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] md:hidden">
        ${buildMobileLinks()}
      </nav>
    `;
  }

  function renderFooter() {
    return `
      <div class="cinefy-footer-shell mt-auto px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-10 md:px-6 md:pb-12 md:pt-14">
        <div class="cinefy-footer-shell__inner mx-auto w-full max-w-[1440px] rounded-[2rem] border border-white/10 bg-zinc-950/78 px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl text-center md:px-7 md:py-6">
          <a class="inline-block text-2xl font-black italic tracking-[-0.08em] text-red-600 transition hover:text-red-500" href="index.html">CINEfy</a>
          <nav aria-label="Rodape" class="mt-4 flex justify-center gap-x-4 gap-y-2 text-sm">
            <a class="text-zinc-300 transition-colors hover:text-red-300" href="index.html">Inicio</a>
            <a class="text-zinc-300 transition-colors hover:text-red-300" href="busca.html">Buscar</a>
            <a class="text-zinc-300 transition-colors hover:text-red-300" href="mailto:felipe53650@outlook.com">Suporte</a>
          </nav>
          <p class="mt-4 text-sm text-zinc-400 md:text-[0.95rem]">Powered by TMDB</p>
        </div>
      </div>
    `;
  }

  function hideLegacyChrome() {
    const selectors = [
      "body > header",
      "body > nav",
      "body > aside",
      "body > footer",
      "body > main > header",
      "body > main > footer",
      "body > main > nav"
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (element.hasAttribute("data-layout")) {
          return;
        }

        element.style.display = "none";
      });
    });
  }

  function wireNotifications() {
    const button = document.getElementById("notificationsButton");
    const panel = document.getElementById("notificationsPanel");
    const markReadButton = document.getElementById("markNotificationsReadButton");

    if (!button || !panel || !store) return;

    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "notificationsPanel");

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setNotificationsVisibility(panel.classList.contains("hidden"), button, panel);
    });

    markReadButton.addEventListener("click", () => {
      store.markAllNotificationsAsRead();
      refreshNotificationsUI();
    });

    document.addEventListener("click", (event) => {
      if (!panel.contains(event.target) && !button.contains(event.target)) {
        setNotificationsVisibility(false, button, panel);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setNotificationsVisibility(false, button, panel);
        button.focus();
      }
    });

    window.addEventListener("cinefy:notifications-updated", (event) => {
      notifications = Array.isArray(event.detail) ? event.detail : store.loadNotifications();
      unreadCount = notifications.filter((notification) => !notification.read).length;
      refreshNotificationsUI();
    });

    if (typeof store.subscribeToNotifications === "function") {
      store.subscribeToNotifications((incomingNotifications) => {
        notifications = incomingNotifications;
        unreadCount = notifications.filter((notification) => !notification.read).length;
        refreshNotificationsUI();
      });
    }
  }

  function wireGlobalSearch() {
    const form = document.getElementById("globalSearchForm");
    const input = document.getElementById("globalSearchInput");
    if (!form || !input) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = String(input.value || "").trim();

      if (currentPage === "buscar") {
        const targetHref = query ? `busca.html?q=${encodeURIComponent(query)}` : "busca.html";
        window.history.replaceState({}, "", targetHref);
        window.dispatchEvent(new CustomEvent("cinefy:global-search", { detail: { query } }));
        return;
      }

      window.location.href = query ? `busca.html?q=${encodeURIComponent(query)}` : "busca.html";
    });

    window.addEventListener("cinefy:search-query-updated", (event) => {
      const query = event && event.detail ? String(event.detail.query || "") : "";
      input.value = query;
    });
  }

  function refreshNotificationsUI() {
    const button = document.getElementById("notificationsButton");
    const panel = document.getElementById("notificationsPanel");
    if (!button || !panel) return;

    const badge = unreadCount
      ? `<span class="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">${Math.min(unreadCount, 9)}</span>`
      : "";

    button.innerHTML = `<span class="material-symbols-outlined text-zinc-300">notifications</span>${badge}`;
    const listContainer = panel.querySelector(".space-y-3");
    if (listContainer) {
      listContainer.innerHTML = buildNotifications();
    }
  }

  function setNotificationsVisibility(isVisible, button, panel) {
    panel.classList.toggle("hidden", !isVisible);
    panel.setAttribute("aria-hidden", String(!isVisible));
    button.setAttribute("aria-expanded", String(isVisible));
  }

  function formatRelative(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "agora";
    }

    const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));

    if (diffMinutes < 60) return `ha ${diffMinutes} min`;
    if (diffMinutes < 1440) return `ha ${Math.round(diffMinutes / 60)} h`;
    return `ha ${Math.round(diffMinutes / 1440)} dia(s)`;
  }

  function resolveNotificationHref(href) {
    const safeHref = String(href || "index.html").trim();

    if (!safeHref || safeHref === "#") {
      return "index.html";
    }

    if (/^(index|lista|busca|amigos|perfil|detalhes|modoleitor|login|cadastro|404)\.html(\?.*)?$/i.test(safeHref)) {
      return escapeAttribute(safeHref);
    }

    return "index.html";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function safeAvatarUrl(value) {
    const candidate = String(value || "").trim();
    if (!candidate) return defaultAvatar;

    if (/^data:image\/(png|jpeg|webp);/i.test(candidate) || candidate.startsWith("blob:")) {
      return candidate;
    }

    try {
      const parsedUrl = new URL(candidate, window.location.origin);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.href;
      }
    } catch (error) {
      return defaultAvatar;
    }

    return defaultAvatar;
  }

  const navbarMount = document.querySelector('[data-layout="navbar"]');
  if (navbarMount) {
    hideLegacyChrome();
    navbarMount.innerHTML = renderNavbar();
    wireNotifications();
    wireGlobalSearch();
  }

  const footerMount = document.querySelector('[data-layout="footer"]');
  if (footerMount) {
    footerMount.innerHTML = renderFooter();
  }
})();
