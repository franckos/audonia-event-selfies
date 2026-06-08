<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-xl">
      <div class="bg-white/90 rounded-3xl shadow-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            <span aria-hidden="true">💙</span>
            Result
          </h2>

          <button
            class="p-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            @click="tryAgain"
            title="Try again"
          >
            <i class="fas fa-arrow-rotate-left text-slate-800"></i>
          </button>
        </div>

        <div class="flex justify-center">
          <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <canvas
              ref="canvasEl"
              class="w-[260px] sm:w-[320px] md:w-[360px] rounded-xl"
            ></canvas>
          </div>
        </div>

        <div class="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            class="flex-1 py-3 rounded-full bg-blue-500 text-white font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            :disabled="!composedUrl"
            @click="download"
          >
            <i class="fas fa-download"></i>
            <span>DOWNLOAD</span>
          </button>

          <button
            v-if="canShare"
            class="flex-1 py-3 rounded-full bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            :disabled="!composedUrl || isSharing"
            @click="share"
          >
            <i v-if="!isSharing" class="fas fa-share"></i>
            <i v-else class="fas fa-circle-notch fa-spin"></i>
            <span>{{ isSharing ? "Sharing..." : "SHARE" }}</span>
          </button>
        </div>

        <!-- Alternative if sharing not supported -->
        <div v-if="!canShare" class="mt-6">
          <button
            class="w-full py-3 rounded-full bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            :disabled="!composedUrl"
            @click="download"
          >
            <i class="fas fa-download"></i>
            <span>DOWNLOAD</span>
          </button>
        </div>

        <p v-if="errorMsg" class="mt-3 text-sm text-red-600 text-center">
          {{ errorMsg }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { pickTextColorFromRegion } from "@/lib/canvasColor";
import {
  compute3StripSlots,
  compute4GridSlots,
  type LayoutMode,
} from "@/lib/layout";
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";

type FilterMode = "none" | "bw" | "sepia";
type Settings = {
  frameUrl: string;
  filter: FilterMode;
  timerSeconds: number;
  layout: LayoutMode;
};

const router = useRouter();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const composedUrl = ref<string>("");
const errorMsg = ref<string>("");

const shots = ref<string[]>(loadShots());
const settings = reactive<Settings>(loadSettings());

const dateStr = computed(() => formatMMDDYYYY(new Date()));

const isSharing = ref(false);

function loadSettings(): Settings {
  const defaults: Settings = {
    frameUrl: "",
    filter: "none",
    timerSeconds: 3,
    layout: "grid-2x2",
  };
  try {
    const raw = sessionStorage.getItem("selfsnap.settings");
    const base = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    // Audonia event flow: frameUrl comes from selfies.event
    if (!base.frameUrl) {
      const eventRaw = sessionStorage.getItem("selfies.event");
      if (eventRaw) {
        const event = JSON.parse(eventRaw);
        if (event?.frameUrl) base.frameUrl = event.frameUrl;
      }
    }
    return base;
  } catch {}
  return defaults;
}

function loadShots(): string[] {
  try {
    const raw = sessionStorage.getItem("selfsnap.shots");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
    }
  } catch {}
  return [];
}

function formatMMDDYYYY(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}.${mm}.${yy}`;
}

function canvasFilterString(mode: FilterMode) {
  if (mode === "bw") return "grayscale(1)";
  if (mode === "sepia") return "sepia(1)";
  return "none";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    (img as any).decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  filter: FilterMode,
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;

  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;

  ctx.save();
  ctx.filter = canvasFilterString(filter);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

async function compose() {
  errorMsg.value = "";
  composedUrl.value = "";

  const shotCount = settings.layout === "strip-3" ? 3 : 4;
  if (shots.value.length !== shotCount) {
    errorMsg.value = `Need exactly ${shotCount} shots to compose. Found: ${shots.value.length}`;
    return;
  }

  const canvas = canvasEl.value;
  if (!canvas) {
    errorMsg.value = "Canvas missing";
    return;
  }

  const W = 1080;
  const H = 1920;

  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    errorMsg.value = "Canvas context missing";
    return;
  }

  // background
  if (settings.frameUrl) {
    const frameImg = await loadImage(settings.frameUrl);
    ctx.drawImage(frameImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
  }

  // slots (must match layout)
  const slots =
    settings.layout === "strip-3"
      ? compute3StripSlots(W, H, {
          outerPad: 44,
          gap: 26,
          headerH: 140,
          footerH: 220,
        })
      : compute4GridSlots(W, H, {
          outerPad: 44,
          gap: 26,
          ratioW: 3,
          ratioH: 4,
          headerH: 140,
          footerH: 220,
        });

  // draw shots
  for (let i = 0; i < shotCount; i++) {
    const shotSrc = shots.value[i];
    const slot = slots[i];
    if (!shotSrc || !slot) throw new Error("Missing shot or slot");

    const shotImg = await loadImage(shotSrc);

    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();

    drawCover(ctx, shotImg, slot.x, slot.y, slot.w, slot.h, settings.filter);
    ctx.restore();
  }

  const headerTextColor = pickTextColorFromRegion(ctx, Math.floor(W * 0.15), 20, Math.floor(W * 0.7), 180);
  const footerTextColor = pickTextColorFromRegion(ctx, Math.floor(W * 0.15), H - 320, Math.floor(W * 0.7), 240);

  ctx.save();
  ctx.textAlign = "center";

  // Title at top
  ctx.fillStyle = headerTextColor;
  ctx.font = "bold 96px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("IA On Track!", W / 2, 120);

  // Date at bottom, smaller
  ctx.fillStyle = footerTextColor;
  ctx.font = "400 48px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(dateStr.value, W / 2, H - 150);

  ctx.restore();
  composedUrl.value = canvas.toDataURL("image/png");
}

async function download() {
  const canvas = canvasEl.value;
  if (!canvas) return;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selfsnap-${dateStr.value}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

const canShare = computed(() => {
  const nav: any = navigator;
  return typeof nav !== "undefined" && typeof nav.share === "function";
});

async function share() {
  const canvas = canvasEl.value;
  if (!canvas) return;

  try {
    isSharing.value = true;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Failed to create image blob")),
        "image/png",
      );
    });

    const fileName = `selfsnap-${dateStr.value}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    const nav: any = navigator;

    if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
      await nav.share({
        files: [file],
        title: "SelfSnap!",
        text: `SelfSnap ${dateStr.value}`,
      });
      return;
    }

    // If file sharing isn't supported, fallback to download
    await download();
  } catch (err: any) {
    if (err?.name === "AbortError") return;

    await download();
  } finally {
    isSharing.value = false;
  }
}

function tryAgain() {
  sessionStorage.removeItem("selfsnap.shots");
  const slug = sessionStorage.getItem("selfies.slug");
  router.push({ path: "/booth", query: slug ? { event: slug } : {} });
}

onMounted(async () => {
  try {
    await compose();
  } catch (err: any) {
    errorMsg.value = err?.message ?? String(err);
  }
});
</script>
