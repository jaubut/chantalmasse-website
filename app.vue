<template>
  <div>
    <TheNav />
    <main>
      <NuxtPage />
    </main>
    <TheFooter />
    <BookingStickyBar reveal-after-selector="#hero" />
    <BookingModal />
    <ContactModal />
  </div>
</template>

<script setup lang="ts">
onMounted(() => {
  document.documentElement.classList.add('has-js')
})
</script>
