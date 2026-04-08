// auth.js - Camada de autenticacao com suporte a Firebase Auth + Firestore
(function () {
  const SESSION_KEY = "cinefy-auth-session";
  const AUTH_FLASH_KEY = "cinefy-auth-flash";
  const PROFILE_KEY = "cinefy-user-profile";
  const AUTH_PAGES = new Set(["login", "cadastro"]);
  const PUBLIC_PAGES = new Set(["index", "busca", "detalhes", "404", "modoleitor"]);
  let firebaseAuthResolved = false;
  const defaultAvatar =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBm2HxOu-EGtKkBUP5RwOS7MwT9dJkKn_7vG4oxQF95I4rUUD0IUB61Lm0FY8S49Y0bEJZbDRec6XyHVVI2wtwYH_Yac791G4SqebfMan9yXRJ3UivuQwzgCwdBZfV8AjzdJvR8j5LLytM3KZHnmCKnmEOrZ0-rvzyHbAHBk71hyUzfZLiQmlLyUxlYWRfQnDaHkVF2KpjNQSbD-cG2NehFuEUFCQThMuDwSpEXw_OnY1VqPbRj-d9qdKH1_QJcw1v3n6wdeP9Dn_q7";

  function getStore() {
    return window.CinefyStore || null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hasFirebaseAuth() {
    return Boolean(window.CinefyFirebase && window.CinefyFirebase.auth);
  }

  function getFirebaseAuth() {
    return hasFirebaseAuth() ? window.CinefyFirebase.auth : null;
  }

  function hasFirestore() {
    return Boolean(window.CinefyFirebase && window.CinefyFirebase.firestore);
  }

  function getFirestore() {
    return hasFirestore() ? window.CinefyFirebase.firestore : null;
  }

  function normalizeRoutePath(path) {
    const sanitizedPath = String(path || "")
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/g, "");
    const lastSegment = sanitizedPath.split("/").pop() || "index";
    return lastSegment.replace(/\.html$/i, "").toLowerCase() || "index";
  }

  function getCurrentPath() {
    return normalizeRoutePath(window.location.pathname);
  }

  function getFirebaseProvider(providerName) {
    if (!hasFirebaseAuth()) return null;

    if (providerName === "google" && window.firebase.auth.GoogleAuthProvider) {
      return new window.firebase.auth.GoogleAuthProvider();
    }

    if (providerName === "facebook" && window.firebase.auth.FacebookAuthProvider) {
      const provider = new window.firebase.auth.FacebookAuthProvider();
      provider.addScope("public_profile");
      return provider;
    }

    return null;
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function sanitizeUsername(value) {
    return (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "cinefyuser";
  }

  function sanitizeEmail(value) {
    const store = getStore();
    if (store && typeof store.sanitizeEmail === "function") {
      return store.sanitizeEmail(value);
    }

    return String(value || "").trim().toLowerCase().slice(0, 160);
  }

  function sanitizeProfilePayload(profile) {
    const store = getStore();
    if (store && typeof store.sanitizeProfile === "function") {
      return store.sanitizeProfile(profile);
    }

    return createProfile(profile || {});
  }

  function createProfile(data) {
    const store = getStore();
    const baseProfile = store ? clone(store.defaultProfile) : {
      username: "cinefyuser",
      displayName: "Novo Usuario",
      bio: "Personalize este texto quando quiser para apresentar seu perfil no CINEfy.",
      avatar: defaultAvatar,
      location: "Brasil"
    };

    const displayName = data.displayName || data.name || "Novo Usuario";
    const usernameSeed = data.username || data.email || displayName;

    return {
      ...baseProfile,
      uid: data.uid || "",
      displayName,
      username: sanitizeUsername(usernameSeed),
      bio: data.bio || baseProfile.bio,
      avatar: data.avatar || baseProfile.avatar || defaultAvatar,
      location: data.location || baseProfile.location || "Brasil",
      theme: data.theme || baseProfile.theme || "ember",
      email: sanitizeEmail(data.email || ""),
      authProvider: data.authProvider || "email"
    };
  }

  function syncProfile(profile) {
    const store = getStore();
    if (store && typeof store.saveProfile === "function") {
      store.saveProfile(profile);
    } else {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
  }

  function startSession(profile) {
    const safeProfile = sanitizeProfilePayload(profile);
    syncProfile(safeProfile);
    saveSession({
      uid: safeProfile.uid || "",
      displayName: safeProfile.displayName,
      email: safeProfile.email || "",
      avatar: safeProfile.avatar || defaultAvatar,
      authProvider: safeProfile.authProvider || "email",
      username: safeProfile.username || "cinefyuser",
      theme: safeProfile.theme || "ember"
    });
  }

  async function syncStoreFromCloud() {
    const store = getStore();
    if (store && typeof store.syncFromCloud === "function") {
      await store.syncFromCloud();
    }
  }

  function redirectTo(path) {
    if (getCurrentPath() === normalizeRoutePath(path)) return;
    window.location.replace(path);
  }

  function goToApp() {
    redirectTo("index.html");
  }

  function requireFirebaseAuth() {
    if (hasFirebaseAuth()) return;
    throw new Error("A autenticacao do Firebase nao esta disponivel neste momento. Recarregue a pagina e tente novamente.");
  }

  function saveAuthFlash(message, type) {
    sessionStorage.setItem(
      AUTH_FLASH_KEY,
      JSON.stringify({
        message,
        type: type || "success"
      })
    );
  }

  function consumeAuthFlash() {
    try {
      const raw = sessionStorage.getItem(AUTH_FLASH_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(AUTH_FLASH_KEY);
      return JSON.parse(raw);
    } catch (error) {
      sessionStorage.removeItem(AUTH_FLASH_KEY);
      return null;
    }
  }

  function normalizeFirebaseUser(user, authProvider) {
    return createProfile({
      uid: user.uid || "",
      displayName: user.displayName || user.email?.split("@")[0] || "Cinefilo",
      email: user.email || "",
      avatar: user.photoURL || defaultAvatar,
      authProvider
    });
  }

  async function saveUserProfileToFirestore(profile) {
    const safeProfile = sanitizeProfilePayload(profile);
    if (!hasFirestore() || !safeProfile.uid) return safeProfile;

    const firestore = getFirestore();
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const removeField = window.firebase.firestore.FieldValue.delete();
    const docRef = firestore.collection("users").doc(safeProfile.uid);
    const existingSnapshot = await docRef.get();
    const existingData = existingSnapshot.exists ? existingSnapshot.data() || {} : {};

    await docRef.set(
      {
        uid: safeProfile.uid,
        displayName: safeProfile.displayName,
        username: safeProfile.username,
        email: removeField,
        avatar: safeProfile.avatar || defaultAvatar,
        bio: safeProfile.bio || "",
        location: safeProfile.location || "Brasil",
        theme: safeProfile.theme || "ember",
        authProvider: safeProfile.authProvider || "email",
        updatedAt: now,
        createdAt: existingData.createdAt || now
      },
      { merge: true }
    );

    return safeProfile;
  }

  async function getUserProfileFromFirestore(uid) {
    if (!hasFirestore() || !uid) return null;

    const snapshot = await getFirestore().collection("users").doc(uid).get();
    if (!snapshot.exists) return null;

    return snapshot.data() || null;
  }

  async function buildUserProfile(user, authProvider, overrideData) {
    const store = getStore();
    const localProfile = store && typeof store.loadProfile === "function"
      ? store.loadProfile()
      : null;
    const remoteProfile = await getUserProfileFromFirestore(user.uid);
    const firebaseProfile = normalizeFirebaseUser(user, authProvider);
    const safeLocalProfile = localProfile && (!localProfile.uid || localProfile.uid === user.uid)
      ? localProfile
      : null;
    const mergedProfile = createProfile({
      ...firebaseProfile,
      ...remoteProfile,
      ...safeLocalProfile,
      ...overrideData,
      uid: user.uid,
      authProvider,
      theme: (overrideData && overrideData.theme)
        || (safeLocalProfile && safeLocalProfile.theme)
        || (remoteProfile && remoteProfile.theme)
        || firebaseProfile.theme
    });

    await saveUserProfileToFirestore(mergedProfile);
    return mergedProfile;
  }

  async function register(name, email, password) {
    if (!name || !email || !password) {
      throw new Error("Preencha nome, e-mail e senha.");
    }

    if (String(password).length > 256) {
      throw new Error("A senha informada excede o tamanho permitido.");
    }

    requireFirebaseAuth();

    const auth = getFirebaseAuth();
    const credential = await auth.createUserWithEmailAndPassword(sanitizeEmail(email), password);
    const user = credential.user;

    if (user && typeof user.updateProfile === "function") {
      await user.updateProfile({ displayName: name });
    }

    const refreshedUser = auth.currentUser || user;
    if (refreshedUser && typeof refreshedUser.sendEmailVerification === "function") {
      await refreshedUser.sendEmailVerification();
    }

    const profile = await buildUserProfile(refreshedUser, "email", { displayName: name });

    syncProfile(profile);
    await auth.signOut();
    saveAuthFlash("Conta criada com sucesso. Verifique seu e-mail antes de fazer login.", "success");
    redirectTo("login.html");
    return profile;
  }

  async function login(email, password) {
    if (!email || !password) {
      throw new Error("Informe e-mail e senha.");
    }

    if (String(password).length > 256) {
      throw new Error("A senha informada excede o tamanho permitido.");
    }

    requireFirebaseAuth();

    const auth = getFirebaseAuth();
    const credential = await auth.signInWithEmailAndPassword(sanitizeEmail(email), password);
    const user = credential.user;

    if (user && Object.prototype.hasOwnProperty.call(user, "emailVerified") && !user.emailVerified) {
      await auth.signOut();
      throw new Error("Por favor, verifique seu e-mail antes de acessar a plataforma.");
    }

    const profile = await buildUserProfile(user, "email");
    startSession(profile);
    await syncStoreFromCloud();
    goToApp();
    return profile;
  }

  async function loginWithProvider(providerName) {
    if (!providerName) {
      throw new Error("Provedor de login invalido.");
    }

    requireFirebaseAuth();

    const provider = getFirebaseProvider(providerName);
    if (!provider) {
      throw new Error(`O provedor ${providerName} nao esta disponivel na configuracao atual.`);
    }

    const auth = getFirebaseAuth();
    try {
      const result = await auth.signInWithPopup(provider);
      const user = result.user;
      const profile = await buildUserProfile(user, providerName);

      startSession(profile);
      await syncStoreFromCloud();
      goToApp();
      return profile;
    } catch (error) {
      console.error(`Erro no login com ${providerName}:`, error && error.code ? { code: error.code } : error);

      if (error && error.code === "auth/invalid-credential") {
        error.cinefyMessage = providerName === "facebook"
          ? "O Facebook autenticou sua conta, mas o Firebase recusou a credencial. Confira se o provedor Facebook esta ativado no Firebase Auth e se o App ID e App Secret sao exatamente os mesmos do Meta."
          : "A credencial retornada por esse provedor foi recusada pelo Firebase. Confira a configuracao do login social no console do Firebase.";
      }

      throw error;
    }
  }

  async function resetPassword(email) {
    if (!email) {
      throw new Error("Informe seu e-mail para recuperar a senha.");
    }

    requireFirebaseAuth();
    await getFirebaseAuth().sendPasswordResetEmail(sanitizeEmail(email));
    return true;
  }

  async function logout() {
    try {
      if (hasFirebaseAuth()) {
        await getFirebaseAuth().signOut();
      }
    } catch (error) {
      console.error("Erro ao sair do Firebase:", error);
    }

    clearSession();
    redirectTo("index.html");
  }

  function getCurrentUser() {
    return loadSession();
  }

  async function saveCurrentProfile(profile) {
    const safeProfile = sanitizeProfilePayload(profile);

    if (hasFirebaseAuth()) {
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser && currentUser.uid === safeProfile.uid && typeof currentUser.updateProfile === "function") {
        try {
          await currentUser.updateProfile({
            displayName: safeProfile.displayName || currentUser.displayName || "Cinefilo",
            photoURL: safeProfile.avatar || currentUser.photoURL || defaultAvatar
          });
        } catch (error) {
          console.error("Erro ao atualizar o perfil no Firebase Auth:", error);
        }
      }
    }

    startSession(safeProfile);

    if (hasFirestore() && safeProfile.uid) {
      await saveUserProfileToFirestore(safeProfile);
    }

    await syncStoreFromCloud();

    return safeProfile;
  }

  function mapFirebaseError(error) {
    if (error && error.cinefyMessage) {
      return new Error(error.cinefyMessage);
    }

    const code = error && error.code ? error.code : "";
    const messages = {
      "auth/email-already-in-use": "Ja existe uma conta cadastrada com este e-mail.",
      "auth/invalid-email": "O e-mail informado nao e valido.",
      "auth/missing-email": "Informe seu e-mail para continuar.",
      "auth/missing-password": "Informe uma senha para continuar.",
      "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
      "auth/user-not-found": "Conta nao encontrada para este e-mail.",
      "auth/wrong-password": "Senha incorreta.",
      "auth/invalid-credential": "E-mail ou senha invalidos.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco antes de tentar novamente.",
      "auth/popup-closed-by-user": "A janela de login foi fechada antes da conclusao.",
      "auth/cancelled-popup-request": "Ja existe uma tentativa de login em andamento.",
      "auth/account-exists-with-different-credential": "Este e-mail ja esta vinculado a outro metodo de acesso.",
      "auth/operation-not-allowed": "Este metodo de login ainda nao foi habilitado no Firebase.",
      "auth/unauthorized-domain": "Este dominio ainda nao foi autorizado no console do Firebase.",
      "auth/network-request-failed": "Falha de rede ao falar com o Firebase. Confira sua conexao."
    };

    return new Error(messages[code] || error.message || "Nao foi possivel concluir a autenticacao.");
  }

  function isAuthPage() {
    return AUTH_PAGES.has(getCurrentPath());
  }

  function isPublicPage() {
    return PUBLIC_PAGES.has(getCurrentPath());
  }

  function isProtectedPage() {
    return !isAuthPage() && !isPublicPage();
  }

  function enforceRouteAccess(user) {
    if (user) {
      if (isAuthPage()) {
        goToApp();
      }
      return;
    }

    if (isProtectedPage() && (!hasFirebaseAuth() || firebaseAuthResolved)) {
      redirectTo("login.html");
    }
  }

  if (hasFirebaseAuth()) {
    getFirebaseAuth().onAuthStateChanged(async (user) => {
      firebaseAuthResolved = true;
      if (!user) {
        clearSession();
        enforceRouteAccess(null);
        return;
      }

      const providerId = user.providerData && user.providerData[0] ? user.providerData[0].providerId : "password";
      const authProvider = providerId.includes("google")
        ? "google"
        : providerId.includes("facebook")
          ? "facebook"
          : "email";

      try {
        const profile = await buildUserProfile(user, authProvider);
        startSession(profile);
        await syncStoreFromCloud();
        enforceRouteAccess(user);
      } catch (error) {
        console.error("Erro ao sincronizar sessao com Firestore:", error);
      }
    });
  } else {
    clearSession();
    enforceRouteAccess(null);
  }

  window.register = register;
  window.login = login;
  window.loginWithProvider = loginWithProvider;
  window.logout = logout;
  window.getCurrentUser = getCurrentUser;
  window.saveCurrentProfile = saveCurrentProfile;
  window.mapFirebaseError = mapFirebaseError;
  window.consumeAuthFlash = consumeAuthFlash;

  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason && event.reason.code && !event.defaultPrevented) {
      event.preventDefault();
      console.error(mapFirebaseError(event.reason));
    }
  });

  window.resetPassword = resetPassword;

  ["register", "login", "loginWithProvider", "logout", "resetPassword"].forEach((method) => {
    const original = window[method];
    if (typeof original !== "function") return;

    window[method] = async function () {
      try {
        return await original.apply(this, arguments);
      } catch (error) {
        throw mapFirebaseError(error);
      }
    };
  });
})();
