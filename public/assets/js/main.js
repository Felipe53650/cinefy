// main.js - Manipulação Global da UI
document.addEventListener('DOMContentLoaded', () => {
    console.log("CINEfy inicializado.");

// Exemplo: Carregar filmes em destaque no Dashboard
if (document.getElementById('featured-movies')) {
    loadFeaturedMovies();
}

});

function loadFeaturedMovies() {
    // Lógica para renderizar os cards de filmes usando os dados da API
}

function toggleMyList(movieId) {
    // Lógica para adicionar ou remover da lista pessoal (localStorage ou DB)
}