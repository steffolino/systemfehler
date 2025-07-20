<script setup>
import { useI18n } from '#imports'

const { locales, locale, setLocale } = useI18n()

function onChange(event) {
  setLocale(event.target.value)
}
</script>

<template>
  <ClientOnly>
    <label for="lang-select" class="sr-only">
      {{ $t('language') }}
    </label>
    <select
      id="lang-select"
      :value="locale"
      class="select select-bordered w-36 text-xs"
      @change="onChange"
    >
      <option
        v-for="loc in locales"
        :key="loc.code"
        :value="loc.code"
      >
        {{ loc.name }}
      </option>
    </select>
  </ClientOnly>
</template>
