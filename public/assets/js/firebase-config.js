(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBYth4q2GuR4ROosgQLU-hcT55hopYa6KI",
    authDomain: "cinefy3-83a9a.firebaseapp.com",
    projectId: "cinefy3-83a9a",
    storageBucket: "cinefy3-83a9a.firebasestorage.app",
    messagingSenderId: "681789753745",
    appId: "1:681789753745:web:559fafb4cf0e11920ff230"
  };

  if (!window.firebase || typeof window.firebase.initializeApp !== "function") {
    console.warn("Firebase SDK nao foi carregada.");
    return;
  }

  if (!window.firebase.apps.length) {
    window.firebase.initializeApp(firebaseConfig);
  }

  window.CinefyFirebase = {
    app: window.firebase.app(),
    auth: typeof window.firebase.auth === "function" ? window.firebase.auth() : null,
    firestore: typeof window.firebase.firestore === "function" ? window.firebase.firestore() : null,
    storage: typeof window.firebase.storage === "function" ? window.firebase.storage() : null,
    config: firebaseConfig
  };
})();
