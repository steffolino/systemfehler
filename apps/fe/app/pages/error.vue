<!-- filepath: c:\Users\StretzS\systemfehler\apps\fe\pages\error.vue -->
<template>
  <div class="error-page">
    <div v-if="error.statusCode === 404">
      <img src="/img/404_1.png" alt="404" style="max-width:300px;" >
      <h1>Seite nicht gefunden</h1>
      <p>Die angeforderte Seite existiert nicht.</p>
    </div>
    <div v-else>
      <img src="/img/500.png" alt="500" style="max-width:300px;" >
      <h1>Fehler {{ error.statusCode }}</h1>
      <p>Ein unerwarteter Fehler ist aufgetreten.</p>
    </div>
    <NuxtLink to="/">Zur Startseite</NuxtLink>
  </div>
</template>

<script setup>
defineProps({ error: Object })
</script>

<style scoped>
.error-page {
  text-align: center;
  padding: 2rem;
}
</style>