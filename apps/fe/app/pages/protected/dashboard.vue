<template>
  <div class="p-6 space-y-6">
    <UCard>
      <template #header>
        <h2 class="text-xl font-semibold">{{ $t('dashboard.title') }}</h2>
      </template>

      <p>{{ $t('dashboard.welcomeMessage') }}</p>

      <div class="mt-4 flex gap-3">
        <UButton color="primary" variant="solid">
          {{ $t('dashboard.getStarted') }}
        </UButton>
        <UButton color="secondary" variant="outline">
          {{ $t('dashboard.learnMore') }}
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
// You can add any logic or composables here
</script>
