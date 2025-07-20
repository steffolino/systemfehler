<template>
  <div class="flex flex-col min-h-screen bg-base-100 text-base-content">
    <!-- Navbar -->
    <div class="navbar sticky top-0 z-50 bg-base-100/75 backdrop-blur border-b border-base-200">
      <div class="flex-1 px-4">
        <span class="text-lg font-bold">Systemfehler</span>
      </div>
      <div class="flex-none gap-2 px-2">
        <LanguageSwitch />
        <ThemeSwitch class="ml-2"/>
      </div>
    </div>

    <!-- Main content -->
    <main class="flex-1 px-4 py-6">
      <div class="max-w-7xl mx-auto">
        <slot />
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-base-200 bg-base-100/75 backdrop-blur text-sm text-center text-base-content px-4 py-4">
      <div class="max-w-7xl mx-auto">
        {{ new Date().getFullYear() }} Systemfehler. No rights reserved.
      </div>
    </footer>
  </div>
</template>

<script setup>
// ThemeSwitch and LanguageSwitch components are assumed to be registered globally or imported if needed.
</script>
