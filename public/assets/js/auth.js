// auth.js - Camada de autenticacao com suporte a Firebase Auth + Firestore
(function () {
  const SESSION_KEY = "cinefy-auth-session";
  const AUTH_FLASH_KEY = "cinefy-auth-flash";
  const PROFILE_KEY = "cinefy-user-profile";
  const AUTH_PAGES = new Set(["login", "cadastro"]);
  const PUBLIC_PAGES = new Set(["index", "busca", "detalhes", "404", "modoleitor"]);
  const USERNAME_MIN_LENGTH = 3;
  const USERNAME_MAX_LENGTH = 24;
  const USERNAME_DISALLOWED_PATTERN = /[\s<>`"'\\/|@]/g;
  const RESERVED_USERNAME_TERMS = [
    "admin",
    "administrador",
    "mod",
    "moderador",
    "suporte",
    "support",
    "staff",
    "owner",
    "official",
    "oficial",
    "cinefy",
    "sistema",
    "system",
    "root",
    "null",
    "undefined"
  ];
  const BLOCKED_USERNAME_TERMS = [
    "fdp",
    "fdputa",
    "filhodaputa",
    "caralho",
    "porra",
    "buceta",
    "piranha",
    "arrombado",
    "arrombada",
    "nazista",
    "hitler",
    "racista",
    "estuprador",
    "estupradora"
  ];
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
      .normalize("NFKC")
      .trim()
      .replace(USERNAME_DISALLOWED_PATTERN, "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, USERNAME_MAX_LENGTH) || "cinefyuser";
  }

  function buildUsernameKey(value) {
    return sanitizeUsername(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function getUsernameDocId(value) {
    return encodeURIComponent(buildUsernameKey(value));
  }

  function getUsernameDocsCollection() {
    return hasFirestore() ? getFirestore().collection("usernames") : null;
  }

  function getModerationKey(value) {
    return buildUsernameKey(value).replace(/[^a-z0-9]+/g, "");
  }

  function isReservedUsername(moderationKey) {
    return RESERVED_USERNAME_TERMS.some((term) => (
      moderationKey === term ||
      new RegExp(`^${term}[0-9]+$`).test(moderationKey)
    ));
  }

  function validateUsernameCandidate(value) {
    const sanitized = sanitizeUsername(value);
    const key = buildUsernameKey(sanitized);
    const moderationKey = getModerationKey(sanitized);

    if (!sanitized) {
      return {
        valid: false,
        sanitized,
        key,
        reason: "empty",
        message: "Escolha um nome de usuario para continuar."
      };
    }

    if (sanitized.length < USERNAME_MIN_LENGTH) {
      return {
        valid: false,
        sanitized,
        key,
        reason: "too-short",
        message: `Use pelo menos ${USERNAME_MIN_LENGTH} caracteres.`
      };
    }

    if (!/^[^\s<>`"'\\/|@]+$/u.test(sanitized)) {
      return {
        valid: false,
        sanitized,
        key,
        reason: "invalid-chars",
        message: "Use letras, numeros e simbolos comuns, sem espacos, barras ou arroba."
      };
    }

    if (isReservedUsername(moderationKey)) {
      return {
        valid: false,
        sanitized,
        key,
        reason: "reserved",
        message: "Esse nome nao esta disponivel no Cinefy Club."
      };
    }

    if (BLOCKED_USERNAME_TERMS.some((term) => moderationKey.includes(term))) {
      return {
        valid: false,
        sanitized,
        key,
        reason: "moderation",
        message: "Esse nome nao atende as regras de boa convivencia da rede."
      };
    }

    return {
      valid: true,
      sanitized,
      key,
      docId: getUsernameDocId(sanitized),
      message: "Nome de usuario disponivel."
    };
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
      usernameKey: "cinefyuser",
      displayName: "Novo Usuario",
      bio: "Personalize este texto quando quiser para apresentar seu perfil no Cinefy Club.",
      avatar: defaultAvatar,
      location: "Brasil"
    };

    const usernameSeed = data.username || data.email || data.displayName || data.name || "cinefyuser";
    const username = sanitizeUsername(usernameSeed);
    const displayName = data.displayName || data.name || username || "Novo Usuario";

    return {
      ...baseProfile,
      uid: data.uid || "",
      displayName,
      username,
      usernameKey: buildUsernameKey(data.usernameKey || username),
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
      usernameKey: safeProfile.usernameKey || buildUsernameKey(safeProfile.username || "cinefyuser"),
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

  async function checkUsernameAvailability(value, options = {}) {
    const validation = validateUsernameCandidate(value);
    if (!validation.valid) {
      return {
        available: false,
        ...validation
      };
    }

    if (!hasFirestore()) {
      return {
        available: true,
        ...validation
      };
    }

    const snapshot = await getUsernameDocsCollection().doc(validation.docId).get();
    const ownerUid = snapshot.exists ? String((snapshot.data() || {}).uid || "") : "";
    const currentUid = String(options.currentUid || "");
    const available = !snapshot.exists || (currentUid && ownerUid === currentUid);

    return {
      available,
      ...validation,
      ownerUid,
      reason: available ? "available" : "taken",
      message: available ? "Nome de usuario disponivel." : "Esse nome de usuario ja esta em uso."
    };
  }

  async function getUsernameSuggestions(value, options = {}) {
    const validation = validateUsernameCandidate(value);
    if (!validation.valid) {
      return [];
    }

    const baseSource = validation.sanitized.replace(/[._-]+$/g, "") || validation.sanitized;
    const candidates = [];
    const seen = new Set([validation.sanitized]);
    const themedSuffixes = ["cine", "filmes", "lista", "club", "watch"];

    function queueCandidate(rawCandidate) {
      const candidate = sanitizeUsername(rawCandidate);
      if (!candidate || seen.has(candidate) || candidate.length < USERNAME_MIN_LENGTH) return;
      seen.add(candidate);
      candidates.push(candidate);
    }

    themedSuffixes.forEach((suffix) => {
      const dottedBase = baseSource.slice(0, Math.max(USERNAME_MAX_LENGTH - (`.${suffix}`).length, USERNAME_MIN_LENGTH));
      const underscoredBase = baseSource.slice(0, Math.max(USERNAME_MAX_LENGTH - (`_${suffix}`).length, USERNAME_MIN_LENGTH));
      queueCandidate(`${dottedBase}.${suffix}`);
      queueCandidate(`${underscoredBase}_${suffix}`);
    });

    for (let index = 2; index <= 20 && candidates.length < 18; index += 1) {
      const dotSuffix = `.${index}`;
      const underscoreSuffix = `_${index}`;
      const dashSuffix = `-${index}`;
      const plainSuffix = `${index}`;

      queueCandidate(`${baseSource.slice(0, Math.max(USERNAME_MAX_LENGTH - dotSuffix.length, USERNAME_MIN_LENGTH))}${dotSuffix}`);
      queueCandidate(`${baseSource.slice(0, Math.max(USERNAME_MAX_LENGTH - underscoreSuffix.length, USERNAME_MIN_LENGTH))}${underscoreSuffix}`);
      queueCandidate(`${baseSource.slice(0, Math.max(USERNAME_MAX_LENGTH - dashSuffix.length, USERNAME_MIN_LENGTH))}${dashSuffix}`);
      queueCandidate(`${baseSource.slice(0, Math.max(USERNAME_MAX_LENGTH - plainSuffix.length, USERNAME_MIN_LENGTH))}${plainSuffix}`);
    }

    const suggestions = [];
    for (const candidate of candidates) {
      const availability = await checkUsernameAvailability(candidate, options);
      if (availability.available) {
        suggestions.push(availability.sanitized);
      }
      if (suggestions.length >= 4) {
        break;
      }
    }

    return suggestions;
  }

  async function findAvailableUsernameVariant(value, currentUid) {
    const baseValidation = validateUsernameCandidate(value);
    if (!baseValidation.valid) {
      throw new Error(baseValidation.message);
    }

    const base = baseValidation.sanitized.slice(0, USERNAME_MAX_LENGTH - 3) || "cinefyuser";
    const directAvailability = await checkUsernameAvailability(baseValidation.sanitized, { currentUid });
    if (directAvailability.available) {
      return directAvailability.sanitized;
    }

    for (let index = 2; index <= 40; index += 1) {
      const candidate = `${base}${index}`;
      const availability = await checkUsernameAvailability(candidate, { currentUid });
      if (availability.available) {
        return availability.sanitized;
      }
    }

    throw new Error("Nao foi possivel gerar um nome de usuario disponivel agora.");
  }

  async function saveUserProfileToFirestore(profile) {
    const safeProfile = sanitizeProfilePayload(profile);
    if (!hasFirestore() || !safeProfile.uid) return safeProfile;

    const firestore = getFirestore();
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const docRef = firestore.collection("users").doc(safeProfile.uid);
    const desiredAvailability = await checkUsernameAvailability(safeProfile.username, { currentUid: safeProfile.uid });
    if (!desiredAvailability.available) {
      const error = new Error(desiredAvailability.message);
      error.code = desiredAvailability.reason === "moderation" || desiredAvailability.reason === "reserved"
        ? "cinefy/username-disallowed"
        : "cinefy/username-taken";
      throw error;
    }

    await firestore.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(docRef);
      const existingData = existingSnapshot.exists ? existingSnapshot.data() || {} : {};
      const previousUsername = existingData.username || "";
      const previousKey = previousUsername ? buildUsernameKey(previousUsername) : "";
      const usernameRef = firestore.collection("usernames").doc(desiredAvailability.docId);
      const usernameSnapshot = await transaction.get(usernameRef);

      if (usernameSnapshot.exists) {
        const usernameData = usernameSnapshot.data() || {};
        if (String(usernameData.uid || "") !== safeProfile.uid) {
          const error = new Error("Esse nome de usuario ja esta em uso.");
          error.code = "cinefy/username-taken";
          throw error;
        }
      }

      transaction.set(
        docRef,
        {
          uid: safeProfile.uid,
          displayName: safeProfile.displayName,
          username: desiredAvailability.sanitized,
          usernameKey: desiredAvailability.key,
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

      transaction.set(
        usernameRef,
        {
          uid: safeProfile.uid,
          username: desiredAvailability.sanitized,
          usernameKey: desiredAvailability.key,
          updatedAt: now,
          createdAt: usernameSnapshot.exists ? (usernameSnapshot.data() || {}).createdAt || now : now
        },
        { merge: true }
      );

      if (previousKey && previousKey !== desiredAvailability.key) {
        const previousRef = firestore.collection("usernames").doc(getUsernameDocId(previousUsername));
        const previousSnapshot = await transaction.get(previousRef);
        if (previousSnapshot.exists && String((previousSnapshot.data() || {}).uid || "") === safeProfile.uid) {
          transaction.delete(previousRef);
        }
      }
    });

    return {
      ...safeProfile,
      username: desiredAvailability.sanitized,
      usernameKey: desiredAvailability.key
    };
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

    try {
      return await saveUserProfileToFirestore(mergedProfile);
    } catch (error) {
      if ((error && error.code === "cinefy/username-taken") && authProvider !== "email") {
        const fallbackUsername = await findAvailableUsernameVariant(mergedProfile.username, user.uid);
        return saveUserProfileToFirestore({
          ...mergedProfile,
          username: fallbackUsername,
          displayName: mergedProfile.displayName || fallbackUsername
        });
      }

      throw error;
    }
  }

  async function register(username, email, password) {
    const usernameValidation = validateUsernameCandidate(username);
    if (!username || !email || !password) {
      throw new Error("Preencha nome de usuario, e-mail e senha.");
    }

    if (!usernameValidation.valid) {
      throw new Error(usernameValidation.message);
    }

    const usernameAvailability = await checkUsernameAvailability(usernameValidation.sanitized);
    if (!usernameAvailability.available) {
      throw new Error(usernameAvailability.message);
    }

    if (String(password).length > 256) {
      throw new Error("A senha informada excede o tamanho permitido.");
    }

    requireFirebaseAuth();

    const auth = getFirebaseAuth();
    const credential = await auth.createUserWithEmailAndPassword(sanitizeEmail(email), password);
    const user = credential.user;

    if (user && typeof user.updateProfile === "function") {
      await user.updateProfile({ displayName: usernameValidation.sanitized });
    }

    try {
      const refreshedUser = auth.currentUser || user;
      if (refreshedUser && typeof refreshedUser.sendEmailVerification === "function") {
        await refreshedUser.sendEmailVerification();
      }

      const profile = await buildUserProfile(refreshedUser, "email", {
        displayName: usernameValidation.sanitized,
        username: usernameValidation.sanitized
      });

      syncProfile(profile);
      await auth.signOut();
      saveAuthFlash("Conta criada com sucesso. Verifique seu e-mail antes de fazer login.", "success");
      redirectTo("login.html");
      return profile;
    } catch (error) {
      try {
        const currentUser = auth.currentUser;
        if (currentUser && typeof currentUser.delete === "function") {
          await currentUser.delete();
        }
      } catch (cleanupError) {
        console.error("Nao foi possivel limpar o usuario apos falha de cadastro:", cleanupError);
      }

      try {
        await auth.signOut();
      } catch (signOutError) {
        console.error("Nao foi possivel encerrar a sessao apos falha de cadastro:", signOutError);
      }

      throw error;
    }
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

      if (error && error.code === "auth/unauthorized-domain") {
        error.cinefyMessage = "Este dominio ainda nao foi autorizado no Firebase Authentication. Adicione cinefyclub.com.br e www.cinefyclub.com.br em Authentication > Settings > Authorized domains.";
      }

      if (error && error.code === "auth/operation-not-supported-in-this-environment") {
        error.cinefyMessage = "O login social nao conseguiu abrir o fluxo seguro neste navegador. Tente novamente apos permitir pop-ups ou revise a configuracao do dominio personalizado no Firebase Auth.";
      }

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

    if (hasFirestore() && safeProfile.uid) {
      const persistedProfile = await saveUserProfileToFirestore(safeProfile);
      startSession(persistedProfile);
      await syncStoreFromCloud();
      return persistedProfile;
    }

    startSession(safeProfile);
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
  window.checkUsernameAvailability = checkUsernameAvailability;
  window.getUsernameSuggestions = getUsernameSuggestions;
  window.validateUsernameCandidate = validateUsernameCandidate;
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
