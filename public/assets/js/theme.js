(function () {
  const PROFILE_KEY = "cinefy-user-profile";
  const DEFAULT_THEME = "ember";
  const THEMES = [
    {
      id: "ember",
      label: "Ember",
      description: "O vermelho cinematografico classico do Cinefy Club.",
      accent: "#e83b24",
      accentStrong: "#9f170d",
      accentSoft: "#ff9a8d",
      background: "#14090a"
    },
    {
      id: "ocean",
      label: "Oceano",
      description: "Azul frio e elegante para uma sessao noturna.",
      accent: "#377dff",
      accentStrong: "#1447a6",
      accentSoft: "#9dceff",
      background: "#08101a"
    },
    {
      id: "emerald",
      label: "Esmeralda",
      description: "Verde sofisticado com contraste suave.",
      accent: "#22c55e",
      accentStrong: "#16803d",
      accentSoft: "#8eefba",
      background: "#08120e"
    },
    {
      id: "aurora",
      label: "Aurora",
      description: "Violeta vibrante para um visual mais autoral.",
      accent: "#8b5cf6",
      accentStrong: "#5b21b6",
      accentSoft: "#cbaaff",
      background: "#110a1d"
    },
    {
      id: "sunset",
      label: "Sunset",
      description: "Laranja quente e acolhedor, com energia de estreia.",
      accent: "#f97316",
      accentStrong: "#c2410c",
      accentSoft: "#ffc08f",
      background: "#180c09"
    },
    {
      id: "rose",
      label: "Rose Velvet",
      description: "Glamouroso e pop, com energia editorial e brilho de tapete vermelho.",
      accent: "#ec4899",
      accentStrong: "#be185d",
      accentSoft: "#fbb6e0",
      background: "#170a12"
    },
    {
      id: "noir",
      label: "Noir",
      description: "Minimalista, monocromatico e elegante, inspirado em thrillers urbanos.",
      accent: "#d4d4d8",
      accentStrong: "#71717a",
      accentSoft: "#f4f4f5",
      background: "#09090b"
    },
    {
      id: "golden-age",
      label: "Golden Age",
      description: "Luxuoso e classico, com clima de cinema antigo e noite de estreia.",
      accent: "#f5c451",
      accentStrong: "#b7791f",
      accentSoft: "#fde7a1",
      background: "#161008"
    }
  ];

  const themeMap = THEMES.reduce((accumulator, theme) => {
    accumulator[theme.id] = theme;
    return accumulator;
  }, {});

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readStoredProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function resolveTheme(themeId) {
    return themeMap[themeId] ? themeId : DEFAULT_THEME;
  }

  function getTheme(themeId) {
    return clone(themeMap[resolveTheme(themeId)]);
  }

  function updateMetaColor(themeId) {
    if (!document.head) return;

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    meta.content = themeMap[resolveTheme(themeId)].accent;
  }

  function applyTheme(themeId) {
    const resolvedTheme = resolveTheme(themeId);
    document.documentElement.setAttribute("data-cinefy-theme", resolvedTheme);
    document.documentElement.style.colorScheme = "dark";
    updateMetaColor(resolvedTheme);
    window.dispatchEvent(new CustomEvent("cinefy:theme-updated", {
      detail: getTheme(resolvedTheme)
    }));
    return getTheme(resolvedTheme);
  }

  function persistTheme(themeId) {
    const resolvedTheme = resolveTheme(themeId);
    const profile = readStoredProfile();
    profile.theme = resolvedTheme;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return resolvedTheme;
  }

  function readStoredTheme() {
    return resolveTheme(readStoredProfile().theme);
  }

  const initialTheme = readStoredTheme();
  document.documentElement.setAttribute("data-cinefy-theme", initialTheme);
  document.documentElement.style.colorScheme = "dark";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => updateMetaColor(initialTheme), { once: true });
  } else {
    updateMetaColor(initialTheme);
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== PROFILE_KEY) return;
    applyTheme(readStoredTheme());
  });

  window.addEventListener("cinefy:profile-updated", (event) => {
    const profile = event.detail && typeof event.detail === "object" ? event.detail : {};
    applyTheme(profile.theme || DEFAULT_THEME);
  });

  window.CinefyTheme = {
    DEFAULT_THEME,
    getThemes: function () {
      return THEMES.map((theme) => clone(theme));
    },
    getTheme,
    getCurrentTheme: function () {
      return resolveTheme(document.documentElement.getAttribute("data-cinefy-theme"));
    },
    resolveTheme,
    applyTheme,
    persistTheme,
    readStoredTheme
  };
})();
