<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="text-6xl font-black tracking-tight text-slate-800">
        SelfSnap!
      </h1>
      <p class="mt-2 text-lg text-slate-700">
        Your snap, your story.
      </p>

    <button
      class="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 font-semibold shadow hover:scale-105 transition"
      @click="go"
    >
      <span>📷</span>
      <span>START</span>
    </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
const router = useRouter();
const go = () => router.push("/settings");
</script>
