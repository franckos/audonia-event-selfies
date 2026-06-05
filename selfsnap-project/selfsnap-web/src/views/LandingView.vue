<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="text-center px-6">
      <div v-if="loading" class="text-slate-400 text-lg">Chargement...</div>
      <div v-else-if="error" class="text-red-500 text-lg">{{ error }}</div>
      <div v-else>
        <div class="text-5xl mb-4">📸</div>
        <h1 class="text-4xl font-black tracking-tight text-slate-800">{{ eventName }}</h1>
        <p class="mt-2 text-lg text-slate-500">Photo booth · 4 shots</p>
        <button
          class="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-800 px-8 py-3 font-semibold text-white shadow hover:scale-105 transition"
          @click="go"
        >
          <span>📷</span>
          <span>START</span>
        </button>
        <p class="mt-4 text-xs text-slate-400">Aucune photo n'est stockée sur nos serveurs.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

const eventName = ref("");
const frameUrl = ref("");
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  const slug = route.query.event as string;
  if (!slug) {
    error.value = "Aucun événement spécifié.";
    loading.value = false;
    return;
  }
  try {
    const res = await fetch(`/api/events/${slug}`);
    if (!res.ok) throw new Error("Événement introuvable.");
    const data = await res.json();
    eventName.value = data.name;
    frameUrl.value = data.frameUrl;
    sessionStorage.setItem("selfsnap.settings", JSON.stringify({
      frameUrl: data.frameUrl,
      filter: "none",
      timerSeconds: 3,
    }));
  } catch (e: any) {
    error.value = e?.message ?? "Erreur de chargement.";
  } finally {
    loading.value = false;
  }
});

const go = () => router.push({ path: "/settings", query: route.query });
</script>
