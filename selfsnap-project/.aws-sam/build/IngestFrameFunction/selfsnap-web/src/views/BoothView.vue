<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-xl">
      <div class="bg-white/90 rounded-3xl shadow-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            📸 Booth
          </h2>
          
          <div class="flex items-center gap-2">
            <button
              class="p-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              @click="flipCamera"
              :disabled="isRunning"
              title="Flip camera"
            >
              <i class="fas fa-camera-rotate text-slate-800"></i>
            </button>
            
            <button
              class="p-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              @click="goBack"
              :disabled="isRunning"
              title="Go back"
            >
              <i class="fas fa-arrow-left text-slate-800"></i>
            </button>
          </div>
        </div>

        <div class="relative w-full max-w-sm mx-auto">
          <div class="relative w-full aspect-[9/16] overflow-hidden rounded-3xl bg-slate-100 shadow-lg">
            <!-- Background frame -->
            <img
              v-if="settings.frameUrl"
              :src="settings.frameUrl"
              class="absolute inset-0 w-full h-full object-cover"
              alt="Frame background"
            />

            <!-- Live camera -->
            <video
            ref="videoEl"
            autoplay
            playsinline
            muted
            class="absolute bg-black object-cover"
            :style="{
                ...activeSlotStyle,
                filter: previewCssFilter,
                WebkitFilter: previewCssFilter,
                transform:
                (facingMode === 'user' ? 'scaleX(-1) ' : '') + 'translateZ(0)',
                willChange: 'transform, filter',
            }"
            />


            <!-- SLOT CONTENT -->
            <div class="absolute inset-0 pointer-events-none">
              <div v-for="(st, idx) in slotStyles" :key="idx" class="absolute" :style="st">
                <!-- Captured shot stays in its slot -->
                <img
                  v-if="shots[idx]"
                  :src="shots[idx]"
                  class="absolute inset-0 w-full h-full object-cover"
                  alt="Captured"
                />

                <div
                  v-else-if="idx !== activeSlotIndex"
                  class="absolute inset-0 bg-white/35"
                ></div>

                <!-- Border guides -->
                <div
                  class="absolute inset-0"
                  :class="idx === activeSlotIndex ? 'ring-4 ring-emerald-400' : 'ring-2 ring-black/10'"
                ></div>

                <!-- Slot number -->
                <div
                  class="absolute -top-3 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="idx === activeSlotIndex ? 'bg-emerald-400 text-black' : 'bg-white/90 text-slate-900'"
                >
                  {{ idx + 1 }}
                </div>
              </div>
            </div>

            <!-- Countdown -->
            <div
              v-if="countdown > 0"
              class="absolute inset-0 flex items-center justify-center bg-black/35"
            >
              <div class="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center text-4xl font-black">
                {{ countdown }}
              </div>
            </div>
          </div>

          <div class="mt-4 flex flex-col items-center justify-center">
            <div v-if="isRunning" class="mb-2 text-center text-sm text-black-500 font-medium">
              <i class="fas fa-circle-notch fa-spin"></i> Capturing...
            </div>
            
            <button
              class="w-16 h-16 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all hover:scale-105 flex items-center justify-center"
              @click="startSequence"
              :disabled="!cameraReady || isRunning"
              :title="isRunning ? 'Capturing...' : 'Start capture'"
            >
              <i class="fas fa-camera text-2xl"></i>
            </button>
          </div>

          <p v-if="errorMsg" class="mt-3 text-sm text-red-600 text-center">{{ errorMsg }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { compute4GridSlots } from "@/lib/layout";

type FilterMode = "none" | "bw" | "sepia";
type Settings = { frameUrl: string; filter: FilterMode; timerSeconds: number };

const router = useRouter();

const videoEl = ref<HTMLVideoElement | null>(null);
const streamRef = ref<MediaStream | null>(null);

const cameraReady = ref(false);
const isRunning = ref(false);
const countdown = ref(0);
const currentShotIndex = ref(0);
const shots = ref<string[]>([]);
const errorMsg = ref<string>("");

const facingMode = ref<"user" | "environment">("user");
const settings = reactive<Settings>(loadSettings());

const FRAME_W = 1080;
const FRAME_H = 1920;

// MUST match ResultView + layout.ts
const LAYOUT = {
  outerPad: 44,
  gap: 26,
  headerH: 140,
  footerH: 220,
  ratioW: 3,
  ratioH: 4,
};

const slotsPx = computed(() =>
  compute4GridSlots(FRAME_W, FRAME_H, {
    outerPad: LAYOUT.outerPad,
    gap: LAYOUT.gap,
    ratioW: LAYOUT.ratioW,
    ratioH: LAYOUT.ratioH,
    headerH: LAYOUT.headerH,
    footerH: LAYOUT.footerH,
  })
);

const slotStyles = computed(() =>
  slotsPx.value.map((s) => ({
    left: `${(s.x / FRAME_W) * 100}%`,
    top: `${(s.y / FRAME_H) * 100}%`,
    width: `${(s.w / FRAME_W) * 100}%`,
    height: `${(s.h / FRAME_H) * 100}%`,
  }))
);

const activeSlotStyle = computed(() => {
  const s = slotsPx.value[activeSlotIndex.value];
  if (!s) return { inset: "0" };

  return {
    left: `${(s.x / FRAME_W) * 100}%`,
    top: `${(s.y / FRAME_H) * 100}%`,
    width: `${(s.w / FRAME_W) * 100}%`,
    height: `${(s.h / FRAME_H) * 100}%`,
  } as Record<string, string>;
});

/**
 * Active slot for preview:
 * - if running: currentShotIndex
 * - if not running: show slot 0 (so user sees where they'll be framed)
 */
const activeSlotIndex = computed(() => (isRunning.value ? currentShotIndex.value : 0));

const previewCssFilter = computed(() => {
  if (settings.filter === "bw") return "grayscale(1)";
  if (settings.filter === "sepia") return "sepia(1)";
  return "none";
});

function loadSettings(): Settings {
  try {
    const raw = sessionStorage.getItem("selfsnap.settings");
    if (raw) return { frameUrl: "", filter: "none", timerSeconds: 3, ...JSON.parse(raw) };
  } catch {}
  return { frameUrl: "", filter: "none", timerSeconds: 3 };
}

function saveShotsToSession(dataUrls: string[]) {
  sessionStorage.setItem("selfsnap.shots", JSON.stringify(dataUrls));
}

async function startCamera() {
  errorMsg.value = "";
  cameraReady.value = false;

  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t) => t.stop());
    streamRef.value = null;
  }

  try {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facingMode.value,
        aspectRatio: { ideal: 3 / 4 },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn("First attempt failed, trying minimal constraints:", err);
      // Fallback to minimal constraints
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode.value },
        audio: false,
      });
    }

    streamRef.value = stream;
    if (!videoEl.value) throw new Error("Video element missing");
    videoEl.value.srcObject = stream;

    // Wait for video to be ready
    await new Promise<void>((resolve, reject) => {
      const v = videoEl.value!;
      const onReady = () => {
        v.removeEventListener("loadedmetadata", onReady);
        resolve();
      };
      const onError = () => {
        v.removeEventListener("error", onError);
        reject(new Error("Video failed to load"));
      };
      v.addEventListener("loadedmetadata", onReady);
      v.addEventListener("error", onError);
      
      setTimeout(() => {
        if (v.readyState >= 1) resolve();
      }, 3000);
    });

    cameraReady.value = true;
  } catch (err: any) {
    errorMsg.value =
      err?.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access."
        : `Failed to start camera: ${err?.message ?? String(err)}`;
    console.error("Camera error:", err);
  }
}

function goBack() {
  router.push("/settings");
}

async function flipCamera() {
  facingMode.value = facingMode.value === "user" ? "environment" : "user";
  await startCamera();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function canvasFilterString(mode: FilterMode) {
  if (mode === "bw") return "grayscale(1)";
  if (mode === "sepia") return "sepia(1)";
  return "none";
}

function drawVideoCoverToCanvas(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outW: number,
  outH: number,
  filterMode: FilterMode
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const scale = Math.max(outW / vw, outH / vh);
  const dw = vw * scale;
  const dh = vh * scale;

  const dx = (outW - dw) / 2;
  const dy = (outH - dh) / 2;

  ctx.save();

  if (facingMode.value === "user") {
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
  }

  ctx.filter = canvasFilterString(filterMode);
  ctx.drawImage(video, dx, dy, dw, dh);

  ctx.restore();
}

async function captureOneShot(_: number): Promise<string> {
  const v = videoEl.value;
  if (!v) throw new Error("Video not ready");

  const outW = 1080;
  const outH = 1440;

  const shotCanvas = document.createElement("canvas");
  shotCanvas.width = outW;
  shotCanvas.height = outH;

  const ctx = shotCanvas.getContext("2d");
  if (!ctx) throw new Error("Shot canvas context missing");

  drawVideoCoverToCanvas(ctx, v, outW, outH, settings.filter);
  applyPixelFilter(ctx, settings.filter, outW, outH);

  return shotCanvas.toDataURL("image/jpeg", 0.92);
}

async function runCountdown(seconds: number) {
  countdown.value = seconds;
  while (countdown.value > 0) {
    await sleep(1000);
    countdown.value -= 1;
  }
}

async function startSequence() {
  if (!cameraReady.value || isRunning.value) return;

  isRunning.value = true;
  errorMsg.value = "";
  shots.value = [];
  currentShotIndex.value = 0;

  try {
    for (let i = 0; i < 4; i++) {
      currentShotIndex.value = i;

      await runCountdown(settings.timerSeconds);
      const shot = await captureOneShot(i);
      shots.value = [...shots.value, shot];

      await sleep(250);
    }

    saveShotsToSession(shots.value);
    router.push("/result");
  } catch (err: any) {
    errorMsg.value = `Capture failed: ${err?.message ?? String(err)}`;
  } finally {
    countdown.value = 0;
    isRunning.value = false;
  }
}

onMounted(async () => {
  Object.assign(settings, loadSettings());
  await startCamera();
});

onBeforeUnmount(() => {
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t) => t.stop());
    streamRef.value = null;
  }
});

function applyPixelFilter(ctx: CanvasRenderingContext2D, mode: FilterMode, w: number, h: number) {
  if (mode === "none") return;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data; // Uint8ClampedArray

  if (mode === "bw") {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] ?? 0;
      const g = d[i + 1] ?? 0;
      const b = d[i + 2] ?? 0;

      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      d[i] = y;
      d[i + 1] = y;
      d[i + 2] = y;
    }
  } else if (mode === "sepia") {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] ?? 0;
      const g = d[i + 1] ?? 0;
      const b = d[i + 2] ?? 0;

      d[i]     = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    }
  }

  ctx.putImageData(img, 0, 0);
}
</script>