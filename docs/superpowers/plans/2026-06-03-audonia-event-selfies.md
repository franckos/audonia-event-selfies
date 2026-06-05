# Audonia Event Selfies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forker SelfSnap et l'intégrer au Laravel Audonia pour servir un photo booth événementiel à `audonia.fr/events/frames?event={slug}`, avec frame et branding automatiques par événement.

**Architecture:** Le frontend Vue est intégré dans `resources/selfies/` du repo Laravel existant sur le VPS (`/home/audonia/docker/app`). Laravel ajoute une route API publique `/api/events/{slug}` qui lit une config JSON par événement, et un catch-all SPA `/events/frames/{any?}` qui sert le `index.html` compilé depuis `public/events/`. Les frames PNG vivent dans `public/frames/`.

**Tech Stack:** Vue 3, TypeScript, Vite, Tailwind CSS 3, Laravel 11, PHP 8.3, Docker (container `laravel-app`)

---

## File Map

### Nouveaux fichiers Laravel (sur le VPS : `/home/audonia/docker/app`)

| Fichier                                             | Rôle                                                           |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `app/Http/Controllers/Api/EventFrameController.php` | Retourne la config JSON d'un événement                         |
| `app/Console/Commands/EventCreate.php`              | Commande Artisan `event:create {slug}`                         |
| `storage/app/events/{slug}.json`                    | Config par événement (créé par Artisan, non versionné)         |
| `public/frames/{slug}.png`                          | Overlay PNG par événement (déposé manuellement, non versionné) |
| `public/events/`                                    | Build Vite Vue (généré, non versionné)                         |

### Fichiers Laravel modifiés

| Fichier          | Modification                    |
| ---------------- | ------------------------------- |
| `routes/web.php` | Ajout route API + catch-all SPA |

### Nouveaux fichiers Vue (`resources/selfies/` dans le repo Laravel)

| Fichier                                         | Rôle                                            |
| ----------------------------------------------- | ----------------------------------------------- |
| `resources/selfies/package.json`                | Dépendances Vue                                 |
| `resources/selfies/vite.config.ts`              | Config Vite avec outDir → `../../public/events` |
| `resources/selfies/tsconfig.json`               | TypeScript config                               |
| `resources/selfies/tsconfig.app.json`           | TypeScript app config                           |
| `resources/selfies/tailwind.config.js`          | Tailwind config                                 |
| `resources/selfies/postcss.config.js`           | PostCSS config                                  |
| `resources/selfies/index.html`                  | Entry point HTML                                |
| `resources/selfies/src/main.ts`                 | Bootstrap Vue                                   |
| `resources/selfies/src/App.vue`                 | Root component                                  |
| `resources/selfies/src/router.ts`               | Routes Vue                                      |
| `resources/selfies/src/composables/useEvent.ts` | Charge config event depuis API                  |
| `resources/selfies/src/views/LandingView.vue`   | Page d'accueil avec nom event                   |
| `resources/selfies/src/views/BoothView.vue`     | Photo booth (frame auto)                        |
| `resources/selfies/src/views/ResultView.vue`    | Résultat + download                             |
| `resources/selfies/src/views/ErrorView.vue`     | Erreur slug manquant/invalide                   |
| `resources/selfies/src/lib/layout.ts`           | Copié à l'identique depuis SelfSnap             |
| `resources/selfies/src/lib/canvasColor.ts`      | Copié à l'identique depuis SelfSnap             |
| `resources/selfies/src/lib/time.ts`             | Copié à l'identique depuis SelfSnap             |
| `resources/selfies/src/lib/filters.ts`          | Copié à l'identique depuis SelfSnap             |

---

## Task 1 : Backend Laravel — EventFrameController

**Contexte :** Toutes les commandes se font via SSH dans le container Laravel.  
**VPS :** `ssh audonia-vps` → user `audonia`, projet dans `/home/audonia/docker/app`  
**Exécuter artisan :** `ssh audonia-vps "docker exec laravel-app php artisan {cmd}"`  
**Editer des fichiers :** modifier directement dans `/home/audonia/docker/app/` via SSH ou en local puis rsync.

**Files:**

- Create: `app/Http/Controllers/Api/EventFrameController.php`
- Modify: `routes/web.php`

- [ ] **Step 1.1 : Créer le controller**

Créer `/home/audonia/docker/app/app/Http/Controllers/Api/EventFrameController.php` :

```php
<?php

namespace App\Http\Controllers\Api;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;

class EventFrameController extends Controller
{
    public function show(string $slug): JsonResponse
    {
        // Valider le slug : lettres, chiffres, tirets uniquement
        if (!preg_match('/^[a-z0-9\-]+$/', $slug)) {
            return response()->json(['error' => 'Invalid event slug'], 400);
        }

        $path = storage_path("app/events/{$slug}.json");

        if (!file_exists($path)) {
            return response()->json(['error' => 'Event not found'], 404);
        }

        $data = json_decode(file_get_contents($path), true);

        if (!$data) {
            return response()->json(['error' => 'Invalid event configuration'], 500);
        }

        return response()->json($data);
    }
}
```

- [ ] **Step 1.2 : Créer le dossier storage/app/events**

```bash
ssh audonia-vps "mkdir -p /home/audonia/docker/app/storage/app/events"
```

- [ ] **Step 1.3 : Ajouter les routes dans `routes/web.php`**

Ajouter à la fin de `/home/audonia/docker/app/routes/web.php`, avant la dernière ligne `?>` s'il y en a une (ou simplement en fin de fichier) :

```php
use App\Http\Controllers\Api\EventFrameController;

// Audonia Event Selfies — API config événement (public, pas de auth)
Route::get('/api/events/{slug}', [EventFrameController::class, 'show'])
    ->name('api.events.show');

// Audonia Event Selfies — SPA catch-all (doit être déclaré en dernier)
Route::get('/events/frames/{any?}', function () {
    $indexPath = public_path('events/index.html');
    if (!file_exists($indexPath)) {
        abort(503, 'Photo booth not deployed yet.');
    }
    return file_get_contents($indexPath);
})->where('any', '.*')->name('events.frames.spa');
```

- [ ] **Step 1.4 : Vérifier que les routes sont enregistrées**

```bash
ssh audonia-vps "docker exec laravel-app php artisan route:list --path=api/events"
ssh audonia-vps "docker exec laravel-app php artisan route:list --path=events/frames"
```

Résultat attendu : 2 routes listées, pas d'erreur.

- [ ] **Step 1.5 : Tester l'API avec un event manquant**

```bash
ssh audonia-vps "docker exec laravel-app curl -s http://localhost/api/events/test-event"
```

Résultat attendu : `{"error":"Event not found"}` avec status 404.  
_(Si curl n'est pas dans le container, utiliser depuis l'extérieur :)_

```bash
curl -s https://www.audonia.fr/api/events/test-event
```

- [ ] **Step 1.6 : Créer un event de test et vérifier l'API**

```bash
ssh audonia-vps "cat > /home/audonia/docker/app/storage/app/events/test-event.json << 'EOF'
{
  \"name\": \"Test Event\",
  \"frameUrl\": \"/frames/test-event.png\",
  \"accentColor\": \"#1A3C5E\",
  \"logo\": null
}
EOF"
```

```bash
curl -s https://www.audonia.fr/api/events/test-event
```

Résultat attendu : `{"name":"Test Event","frameUrl":"/frames/test-event.png","accentColor":"#1A3C5E","logo":null}`

- [ ] **Step 1.7 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add app/Http/Controllers/Api/EventFrameController.php routes/web.php && git commit -m 'feat: add EventFrameController and SPA catch-all route for event selfies'"
```

---

## Task 2 : Commande Artisan `event:create`

**Files:**

- Create: `app/Console/Commands/EventCreate.php`

- [ ] **Step 2.1 : Créer la commande**

Créer `/home/audonia/docker/app/app/Console/Commands/EventCreate.php` :

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class EventCreate extends Command
{
    protected $signature = 'event:create {slug : Slug de l\'événement (ex: zeiss-atelier-1)}';
    protected $description = 'Créer la configuration d\'un événement photo booth';

    public function handle(): int
    {
        $slug = $this->argument('slug');

        if (!preg_match('/^[a-z0-9\-]+$/', $slug)) {
            $this->error('Slug invalide. Utilisez uniquement des lettres minuscules, chiffres et tirets.');
            return 1;
        }

        $path = storage_path("app/events/{$slug}.json");

        if (file_exists($path)) {
            $this->warn("L'événement '{$slug}' existe déjà : {$path}");
            return 0;
        }

        $config = [
            'name'         => ucwords(str_replace('-', ' ', $slug)),
            'frameUrl'     => "/frames/{$slug}.png",
            'accentColor'  => '#1A3C5E',
            'logo'         => null,
        ];

        if (!is_dir(storage_path('app/events'))) {
            mkdir(storage_path('app/events'), 0755, true);
        }

        file_put_contents($path, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->info("Événement créé : {$path}");
        $this->line("Prochaines étapes :");
        $this->line("  1. Éditer {$path} pour personnaliser name, accentColor, logo");
        $this->line("  2. Déposer le frame PNG dans public/frames/{$slug}.png");
        $this->line("  3. URL : https://www.audonia.fr/events/frames?event={$slug}");

        return 0;
    }
}
```

- [ ] **Step 2.2 : Tester la commande**

```bash
ssh audonia-vps "docker exec laravel-app php artisan event:create zeiss-atelier-1"
```

Résultat attendu :

```
Événement créé : /var/www/html/storage/app/events/zeiss-atelier-1.json
Prochaines étapes :
  1. Éditer ...
  2. Déposer le frame PNG ...
  3. URL : https://www.audonia.fr/events/frames?event=zeiss-atelier-1
```

- [ ] **Step 2.3 : Vérifier le fichier créé**

```bash
ssh audonia-vps "cat /home/audonia/docker/app/storage/app/events/zeiss-atelier-1.json"
```

Résultat attendu :

```json
{
  "name": "Zeiss Atelier 1",
  "frameUrl": "/frames/zeiss-atelier-1.png",
  "accentColor": "#1A3C5E",
  "logo": null
}
```

- [ ] **Step 2.4 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add app/Console/Commands/EventCreate.php && git commit -m 'feat: add event:create artisan command'"
```

---

## Task 3 : Scaffold du projet Vue dans resources/selfies

**Contexte :** On copie la structure de `selfsnap-web` et on l'adapte. Toutes les commandes suivantes s'exécutent **sur le VPS** dans `/home/audonia/docker/app`.

**Files:**

- Create: `resources/selfies/package.json`
- Create: `resources/selfies/vite.config.ts`
- Create: `resources/selfies/tsconfig.json`
- Create: `resources/selfies/tsconfig.app.json`
- Create: `resources/selfies/tailwind.config.js`
- Create: `resources/selfies/postcss.config.js`
- Create: `resources/selfies/index.html`

- [ ] **Step 3.1 : Créer la structure de dossiers**

```bash
ssh audonia-vps "mkdir -p /home/audonia/docker/app/resources/selfies/src/{views,composables,lib}"
ssh audonia-vps "mkdir -p /home/audonia/docker/app/resources/selfies/public"
```

- [ ] **Step 3.2 : Créer `package.json`**

Créer `/home/audonia/docker/app/resources/selfies/package.json` :

```json
{
  "name": "audonia-event-selfies",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@fortawesome/fontawesome-free": "^7.1.0",
    "vue": "^3.5.24",
    "vue-router": "^4.6.4"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@vitejs/plugin-vue": "^6.0.1",
    "@vue/tsconfig": "^0.8.1",
    "autoprefixer": "^10.4.23",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.9.3",
    "vite": "^7.2.4",
    "vue-tsc": "^3.1.4"
  }
}
```

- [ ] **Step 3.3 : Créer `vite.config.ts`**

Créer `/home/audonia/docker/app/resources/selfies/vite.config.ts` :

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  base: "/events/frames/",
  build: {
    outDir: "../../public/events",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3.4 : Créer `tsconfig.json`**

Créer `/home/audonia/docker/app/resources/selfies/tsconfig.json` :

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

- [ ] **Step 3.5 : Créer `tsconfig.app.json`**

Créer `/home/audonia/docker/app/resources/selfies/tsconfig.app.json` :

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "include": ["src/**/*", "src/**/*.vue"],
  "exclude": ["src/**/__tests__/*"],
  "compilerOptions": {
    "composite": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 3.6 : Créer `tailwind.config.js`**

Créer `/home/audonia/docker/app/resources/selfies/tailwind.config.js` :

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 3.7 : Créer `postcss.config.js`**

Créer `/home/audonia/docker/app/resources/selfies/postcss.config.js` :

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3.8 : Créer `index.html`**

Créer `/home/audonia/docker/app/resources/selfies/index.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Audonia Event Selfies</title>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
    />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3.9 : Installer les dépendances**

```bash
ssh audonia-vps "cd /home/audonia/docker/app/resources/selfies && npm install"
```

Résultat attendu : `added N packages` sans erreur.

- [ ] **Step 3.10 : Commit du scaffold**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/package.json resources/selfies/vite.config.ts resources/selfies/tsconfig.json resources/selfies/tsconfig.app.json resources/selfies/tailwind.config.js resources/selfies/postcss.config.js resources/selfies/index.html && git commit -m 'feat: scaffold audonia-event-selfies Vue project in resources/selfies'"
```

---

## Task 4 : Librairies partagées (copie depuis SelfSnap)

**Files:**

- Create: `resources/selfies/src/lib/layout.ts`
- Create: `resources/selfies/src/lib/canvasColor.ts`
- Create: `resources/selfies/src/lib/time.ts`
- Create: `resources/selfies/src/lib/filters.ts`
- Create: `resources/selfies/src/style.css`

- [ ] **Step 4.1 : Créer `src/lib/layout.ts`** (identique à l'original)

Créer `/home/audonia/docker/app/resources/selfies/src/lib/layout.ts` :

```ts
export type Rect = { x: number; y: number; w: number; h: number };

export function compute4GridSlots(
  canvasW: number,
  canvasH: number,
  opts?: {
    outerPad?: number;
    gap?: number;
    ratioW?: number;
    ratioH?: number;
    headerH?: number;
    footerH?: number;
  },
): Rect[] {
  const outerPad = opts?.outerPad ?? Math.round(canvasW * 0.04);
  const gap = opts?.gap ?? Math.round(canvasW * 0.025);
  const ratioW = opts?.ratioW ?? 3;
  const ratioH = opts?.ratioH ?? 4;

  const headerH = opts?.headerH ?? Math.round(canvasH * 0.06);
  const footerH = opts?.footerH ?? Math.round(canvasH * 0.07);

  const usableW = canvasW - outerPad * 2;
  const usableH = canvasH - outerPad * 2 - headerH - footerH;

  const cellW = (usableW - gap) / 2;
  const cellH = (usableH - gap) / 2;

  const cellRatio = cellW / cellH;
  const targetRatio = ratioW / ratioH;

  let shotW: number, shotH: number;
  if (cellRatio > targetRatio) {
    shotH = cellH;
    shotW = shotH * targetRatio;
  } else {
    shotW = cellW;
    shotH = shotW / targetRatio;
  }

  const gridLeft = outerPad + (usableW - (shotW * 2 + gap)) / 2;
  const gridTop = outerPad + headerH + Math.round(canvasH * 0.006);

  return [
    { x: gridLeft, y: gridTop, w: shotW, h: shotH },
    { x: gridLeft + shotW + gap, y: gridTop, w: shotW, h: shotH },
    { x: gridLeft, y: gridTop + shotH + gap, w: shotW, h: shotH },
    { x: gridLeft + shotW + gap, y: gridTop + shotH + gap, w: shotW, h: shotH },
  ];
}
```

- [ ] **Step 4.2 : Créer `src/lib/canvasColor.ts`** (identique à l'original)

Créer `/home/audonia/docker/app/resources/selfies/src/lib/canvasColor.ts` :

```ts
export function pickTextColorFromRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: { threshold?: number },
) {
  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;

  let r = 0,
    g = 0,
    b = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }

  r /= pixelCount;
  g /= pixelCount;
  b /= pixelCount;

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const threshold = options?.threshold ?? 150;

  return luminance > threshold ? "#000000" : "#FFFFFF";
}
```

- [ ] **Step 4.3 : Créer `src/lib/time.ts`** (identique à l'original)

Créer `/home/audonia/docker/app/resources/selfies/src/lib/time.ts` :

```ts
export const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));
```

- [ ] **Step 4.4 : Créer `src/lib/filters.ts`** (identique à l'original)

Créer `/home/audonia/docker/app/resources/selfies/src/lib/filters.ts` :

```ts
export type FilterMode = "none" | "bw" | "sepia";

export function ctxFilter(mode: FilterMode): string {
  switch (mode) {
    case "bw":
      return "grayscale(1)";
    case "sepia":
      return "sepia(1)";
    default:
      return "none";
  }
}
```

- [ ] **Step 4.5 : Créer `src/style.css`**

Créer `/home/audonia/docker/app/resources/selfies/src/style.css` :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    Segoe UI,
    Roboto,
    Arial,
    sans-serif;
  background: #f1f5f9;
  min-height: 100vh;
}
```

- [ ] **Step 4.6 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/src/lib/ resources/selfies/src/style.css && git commit -m 'feat: add shared libs (layout, canvasColor, time, filters)'"
```

---

## Task 5 : Composable `useEvent`

**Files:**

- Create: `resources/selfies/src/composables/useEvent.ts`

- [ ] **Step 5.1 : Créer le type EventConfig**

Créer `/home/audonia/docker/app/resources/selfies/src/composables/useEvent.ts` :

```ts
import { ref, readonly } from "vue";

export type EventConfig = {
  name: string;
  frameUrl: string;
  accentColor: string;
  logo: string | null;
};

type EventState = {
  config: EventConfig | null;
  loading: boolean;
  error: string | null;
  slug: string | null;
};

const state = ref<EventState>({
  config: null,
  loading: false,
  error: null,
  slug: null,
});

export function useEvent() {
  function getSlugFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("event");
    if (!slug || !/^[a-z0-9\-]+$/.test(slug)) return null;
    return slug;
  }

  async function loadEvent(): Promise<void> {
    const slug = getSlugFromUrl();

    if (!slug) {
      state.value.error = "Paramètre ?event= manquant ou invalide dans l'URL.";
      state.value.loading = false;
      return;
    }

    state.value.slug = slug;
    state.value.loading = true;
    state.value.error = null;

    try {
      const res = await fetch(`/api/events/${slug}`);

      if (res.status === 404) {
        state.value.error = `Événement "${slug}" introuvable.`;
        return;
      }

      if (!res.ok) {
        state.value.error = `Erreur serveur (${res.status}).`;
        return;
      }

      state.value.config = (await res.json()) as EventConfig;
    } catch {
      state.value.error =
        "Impossible de contacter le serveur. Vérifiez votre connexion.";
    } finally {
      state.value.loading = false;
    }
  }

  return {
    config: readonly(state.value),
    loadEvent,
    getSlugFromUrl,
  };
}
```

- [ ] **Step 5.2 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/src/composables/useEvent.ts && git commit -m 'feat: add useEvent composable'"
```

---

## Task 6 : Router et App.vue

**Files:**

- Create: `resources/selfies/src/router.ts`
- Create: `resources/selfies/src/App.vue`
- Create: `resources/selfies/src/main.ts`

- [ ] **Step 6.1 : Créer `src/router.ts`**

Créer `/home/audonia/docker/app/resources/selfies/src/router.ts` :

```ts
import { createRouter, createWebHistory } from "vue-router";
import LandingView from "./views/LandingView.vue";
import BoothView from "./views/BoothView.vue";
import ResultView from "./views/ResultView.vue";
import ErrorView from "./views/ErrorView.vue";

export const router = createRouter({
  history: createWebHistory("/events/frames/"),
  routes: [
    { path: "/", name: "home", component: LandingView },
    { path: "/booth", name: "booth", component: BoothView },
    { path: "/result", name: "result", component: ResultView },
    { path: "/error", name: "error", component: ErrorView },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
```

- [ ] **Step 6.2 : Créer `src/App.vue`**

Créer `/home/audonia/docker/app/resources/selfies/src/App.vue` :

```vue
<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
</script>
```

- [ ] **Step 6.3 : Créer `src/main.ts`**

Créer `/home/audonia/docker/app/resources/selfies/src/main.ts` :

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./style.css";

createApp(App).use(router).mount("#app");
```

- [ ] **Step 6.4 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/src/router.ts resources/selfies/src/App.vue resources/selfies/src/main.ts && git commit -m 'feat: add router and App.vue'"
```

---

## Task 7 : ErrorView

**Files:**

- Create: `resources/selfies/src/views/ErrorView.vue`

- [ ] **Step 7.1 : Créer `ErrorView.vue`**

Créer `/home/audonia/docker/app/resources/selfies/src/views/ErrorView.vue` :

```vue
<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
      <div class="text-5xl mb-4">📸</div>
      <h1 class="text-2xl font-bold text-slate-800 mb-2">
        Événement introuvable
      </h1>
      <p class="text-slate-500 text-sm mb-6">{{ message }}</p>
      <p class="text-xs text-slate-400">
        Vérifiez l'URL ou contactez l'organisateur de l'événement.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const message = computed(() =>
  typeof route.query.message === "string"
    ? route.query.message
    : "Ce lien ne correspond à aucun événement actif.",
);
</script>
```

- [ ] **Step 7.2 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/src/views/ErrorView.vue && git commit -m 'feat: add ErrorView'"
```

---

## Task 8 : LandingView

**Files:**

- Create: `resources/selfies/src/views/LandingView.vue`

- [ ] **Step 8.1 : Créer `LandingView.vue`**

Créer `/home/audonia/docker/app/resources/selfies/src/views/LandingView.vue` :

```vue
<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <!-- Loading -->
    <div v-if="state.loading" class="text-center">
      <i class="fas fa-circle-notch fa-spin text-4xl text-slate-400"></i>
    </div>

    <!-- Error -->
    <div
      v-else-if="state.error"
      class="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center"
    >
      <div class="text-5xl mb-4">📸</div>
      <h1 class="text-2xl font-bold text-slate-800 mb-2">
        Événement introuvable
      </h1>
      <p class="text-slate-500 text-sm">{{ state.error }}</p>
    </div>

    <!-- Event loaded -->
    <div v-else-if="state.config" class="text-center">
      <img
        v-if="state.config.logo"
        :src="state.config.logo"
        alt="Logo"
        class="h-16 mx-auto mb-6 object-contain"
      />
      <div v-else class="text-5xl mb-4">📸</div>

      <h1 class="text-4xl font-black tracking-tight text-slate-800 mb-2">
        {{ state.config.name }}
      </h1>
      <p class="text-slate-500 mb-8">Photo booth · 4 shots</p>

      <button
        class="inline-flex items-center gap-2 rounded-full px-10 py-4 text-white font-bold text-lg shadow-lg hover:scale-105 transition-transform"
        :style="{ backgroundColor: state.config.accentColor }"
        @click="start"
      >
        <i class="fas fa-camera"></i>
        <span>START</span>
      </button>

      <p class="mt-6 text-xs text-slate-400">
        Aucune photo n'est stockée sur nos serveurs.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { useEvent } from "@/composables/useEvent";

const router = useRouter();
const { loadEvent } = useEvent();

const state = reactive({
  config: null as import("@/composables/useEvent").EventConfig | null,
  loading: true,
  error: null as string | null,
});

onMounted(async () => {
  const { config, loadEvent: load } = useEvent();
  // Re-instancier pour avoir l'état local réactif
  state.loading = true;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("event");

  if (!slug) {
    state.error = "Paramètre ?event= manquant dans l'URL.";
    state.loading = false;
    return;
  }

  try {
    const res = await fetch(`/api/events/${slug}`);
    if (res.status === 404) {
      state.error = `Événement "${slug}" introuvable.`;
      return;
    }
    if (!res.ok) {
      state.error = `Erreur serveur (${res.status}).`;
      return;
    }
    state.config = await res.json();
    // Stocker en sessionStorage pour les vues suivantes
    sessionStorage.setItem("selfies.event", JSON.stringify(state.config));
    sessionStorage.setItem("selfies.slug", slug);
  } catch {
    state.error = "Impossible de contacter le serveur.";
  } finally {
    state.loading = false;
  }
});

function start() {
  router.push("/booth");
}
</script>
```

- [ ] **Step 8.2 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/src/views/LandingView.vue && git commit -m 'feat: add LandingView with event config loading'"
```

---

## Task 9 : BoothView

**Files:**

- Create: `resources/selfies/src/views/BoothView.vue`

- [ ] **Step 9.1 : Créer `BoothView.vue`**

Créer `/home/audonia/docker/app/resources/selfies/src/views/BoothView.vue` :

```vue
<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-xl">
      <div class="bg-white/90 rounded-3xl shadow-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold flex items-center gap-2">📸 Booth</h2>
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
          <div
            class="relative w-full aspect-[9/16] overflow-hidden rounded-3xl bg-slate-100 shadow-lg"
          >
            <!-- Background frame -->
            <img
              v-if="eventConfig?.frameUrl"
              :src="eventConfig.frameUrl"
              class="absolute inset-0 w-full h-full object-cover"
              alt="Frame"
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
                transform:
                  (facingMode === 'user' ? 'scaleX(-1) ' : '') +
                  'translateZ(0)',
                willChange: 'transform',
              }"
            />

            <!-- Slot overlays -->
            <div class="absolute inset-0 pointer-events-none">
              <div
                v-for="(st, idx) in slotStyles"
                :key="idx"
                class="absolute"
                :style="st"
              >
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
                <div
                  class="absolute inset-0"
                  :class="
                    idx === activeSlotIndex
                      ? 'ring-4 ring-emerald-400'
                      : 'ring-2 ring-black/10'
                  "
                ></div>
                <div
                  class="absolute -top-3 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="
                    idx === activeSlotIndex
                      ? 'bg-emerald-400 text-black'
                      : 'bg-white/90 text-slate-900'
                  "
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
              <div
                class="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center text-4xl font-black"
              >
                {{ countdown }}
              </div>
            </div>
          </div>

          <div class="mt-4 flex flex-col items-center justify-center">
            <div
              v-if="isRunning"
              class="mb-2 text-center text-sm text-slate-500 font-medium"
            >
              <i class="fas fa-circle-notch fa-spin"></i> Capturing...
            </div>
            <button
              class="w-16 h-16 rounded-full text-white hover:scale-105 disabled:opacity-50 transition-all flex items-center justify-center"
              :style="{ backgroundColor: accentColor }"
              @click="startSequence"
              :disabled="!cameraReady || isRunning"
            >
              <i class="fas fa-camera text-2xl"></i>
            </button>
          </div>

          <p v-if="errorMsg" class="mt-3 text-sm text-red-600 text-center">
            {{ errorMsg }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { compute4GridSlots } from "@/lib/layout";
import { sleep } from "@/lib/time";
import type { EventConfig } from "@/composables/useEvent";

const router = useRouter();

const FRAME_W = 1080;
const FRAME_H = 1920;
const LAYOUT = {
  outerPad: 44,
  gap: 26,
  headerH: 140,
  footerH: 220,
  ratioW: 3,
  ratioH: 4,
};
const TIMER_SECONDS = 3;

const videoEl = ref<HTMLVideoElement | null>(null);
const streamRef = ref<MediaStream | null>(null);
const cameraReady = ref(false);
const isRunning = ref(false);
const countdown = ref(0);
const currentShotIndex = ref(0);
const shots = ref<string[]>([]);
const errorMsg = ref("");
const facingMode = ref<"user" | "environment">("user");

const eventConfig = ref<EventConfig | null>(null);
const accentColor = computed(() => eventConfig.value?.accentColor ?? "#10b981");

const slotsPx = computed(() => compute4GridSlots(FRAME_W, FRAME_H, LAYOUT));

const slotStyles = computed(() =>
  slotsPx.value.map((s) => ({
    left: `${(s.x / FRAME_W) * 100}%`,
    top: `${(s.y / FRAME_H) * 100}%`,
    width: `${(s.w / FRAME_W) * 100}%`,
    height: `${(s.h / FRAME_H) * 100}%`,
  })),
);

const activeSlotIndex = computed(() =>
  isRunning.value ? currentShotIndex.value : 0,
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

function loadEventFromSession() {
  try {
    const raw = sessionStorage.getItem("selfies.event");
    if (raw) eventConfig.value = JSON.parse(raw);
  } catch {}
}

async function startCamera() {
  errorMsg.value = "";
  cameraReady.value = false;
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t) => t.stop());
    streamRef.value = null;
  }
  try {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode.value,
          aspectRatio: { ideal: 3 / 4 },
          width: { ideal: 1920 },
        },
        audio: false,
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode.value },
        audio: false,
      });
    }
    streamRef.value = stream;
    if (!videoEl.value) throw new Error("Video element missing");
    videoEl.value.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      const v = videoEl.value!;
      v.addEventListener("loadedmetadata", () => resolve(), { once: true });
      v.addEventListener(
        "error",
        () => reject(new Error("Video failed to load")),
        { once: true },
      );
      setTimeout(() => {
        if (v.readyState >= 1) resolve();
      }, 3000);
    });
    cameraReady.value = true;
  } catch (err: any) {
    errorMsg.value =
      err?.name === "NotAllowedError"
        ? "Camera permission denied."
        : `Failed to start camera: ${err?.message ?? String(err)}`;
  }
}

async function flipCamera() {
  facingMode.value = facingMode.value === "user" ? "environment" : "user";
  await startCamera();
}

function goBack() {
  router.push("/");
}

function captureOneShot(): string {
  const v = videoEl.value;
  if (!v) throw new Error("Video not ready");
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1440;
  const ctx = c.getContext("2d")!;
  const vw = v.videoWidth,
    vh = v.videoHeight;
  const scale = Math.max(1080 / vw, 1440 / vh);
  const dw = vw * scale,
    dh = vh * scale;
  ctx.save();
  if (facingMode.value === "user") {
    ctx.translate(1080, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, (1080 - dw) / 2, (1440 - dh) / 2, dw, dh);
  ctx.restore();
  return c.toDataURL("image/jpeg", 0.92);
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
      await runCountdown(TIMER_SECONDS);
      shots.value = [...shots.value, captureOneShot()];
      await sleep(250);
    }
    sessionStorage.setItem("selfies.shots", JSON.stringify(shots.value));
    router.push("/result");
  } catch (err: any) {
    errorMsg.value = `Capture failed: ${err?.message ?? String(err)}`;
  } finally {
    countdown.value = 0;
    isRunning.value = false;
  }
}

onMounted(async () => {
  loadEventFromSession();
  await startCamera();
});

onBeforeUnmount(() => {
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t) => t.stop());
    streamRef.value = null;
  }
});
</script>
```

- [ ] **Step 9.2 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/src/views/BoothView.vue && git commit -m 'feat: add BoothView with auto frame loading'"
```

---

## Task 10 : ResultView

**Files:**

- Create: `resources/selfies/src/views/ResultView.vue`

- [ ] **Step 10.1 : Créer `ResultView.vue`**

Créer `/home/audonia/docker/app/resources/selfies/src/views/ResultView.vue` :

```vue
<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-xl">
      <div class="bg-white/90 rounded-3xl shadow-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold">💙 Result</h2>
          <button
            class="p-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            @click="tryAgain"
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
            class="flex-1 py-3 rounded-full text-white font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            :style="{ backgroundColor: accentColor }"
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

        <p v-if="errorMsg" class="mt-3 text-sm text-red-600 text-center">
          {{ errorMsg }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { compute4GridSlots } from "@/lib/layout";
import { pickTextColorFromRegion } from "@/lib/canvasColor";
import type { EventConfig } from "@/composables/useEvent";

const router = useRouter();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const composedUrl = ref("");
const errorMsg = ref("");
const isSharing = ref(false);

const eventConfig = ref<EventConfig | null>(null);
const shots = ref<string[]>([]);

const accentColor = computed(() => eventConfig.value?.accentColor ?? "#3b82f6");

function formatMMDDYYYY(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
}

const dateStr = computed(() => formatMMDDYYYY(new Date()));

function loadFromSession() {
  try {
    const rawEvent = sessionStorage.getItem("selfies.event");
    if (rawEvent) eventConfig.value = JSON.parse(rawEvent);

    const rawShots = sessionStorage.getItem("selfies.shots");
    if (rawShots) {
      const arr = JSON.parse(rawShots);
      if (Array.isArray(arr))
        shots.value = arr.filter((x) => typeof x === "string");
    }
  } catch {}
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
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
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale,
    sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2,
    sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function compose() {
  errorMsg.value = "";
  composedUrl.value = "";

  if (shots.value.length !== 4) {
    errorMsg.value = `4 shots requis. Trouvé : ${shots.value.length}`;
    return;
  }

  const canvas = canvasEl.value;
  if (!canvas) return;

  const W = 1080,
    H = 1920;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background frame ou blanc
  if (eventConfig.value?.frameUrl) {
    const frameImg = await loadImage(eventConfig.value.frameUrl);
    ctx.drawImage(frameImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
  }

  // Slots
  const slots = compute4GridSlots(W, H, {
    outerPad: 44,
    gap: 26,
    ratioW: 3,
    ratioH: 4,
    headerH: 140,
    footerH: 220,
  });

  for (let i = 0; i < 4; i++) {
    const slot = slots[i]!;
    const shotImg = await loadImage(shots.value[i]!);
    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();
    drawCover(ctx, shotImg, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  }

  // Footer text
  const footerColor = pickTextColorFromRegion(
    ctx,
    Math.floor(W * 0.15),
    H - 320,
    Math.floor(W * 0.7),
    240,
  );

  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = footerColor;

  // Nom de l'événement
  ctx.font = "bold 72px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(eventConfig.value?.name ?? "Audonia", W / 2, H - 220);

  // Date
  ctx.font = "500 48px system-ui, -apple-system, Segoe UI, Roboto, Arial";
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
    a.download = `audonia-${eventConfig.value?.name?.toLowerCase().replace(/\s+/g, "-") ?? "selfie"}-${dateStr.value}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

const canShare = computed(() => typeof (navigator as any).share === "function");

async function share() {
  const canvas = canvasEl.value;
  if (!canvas) return;
  try {
    isSharing.value = true;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Blob failed"))),
        "image/png",
      ),
    );
    const file = new File([blob], `audonia-selfie-${dateStr.value}.png`, {
      type: "image/png",
    });
    const nav = navigator as any;
    if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
      await nav.share({
        files: [file],
        title: eventConfig.value?.name ?? "Audonia Selfie",
        text: dateStr.value,
      });
      return;
    }
    await download();
  } catch (err: any) {
    if (err?.name !== "AbortError") await download();
  } finally {
    isSharing.value = false;
  }
}

function tryAgain() {
  sessionStorage.removeItem("selfies.shots");
  router.push("/");
}

onMounted(async () => {
  loadFromSession();
  try {
    await compose();
  } catch (err: any) {
    errorMsg.value = err?.message ?? String(err);
  }
});
</script>
```

- [ ] **Step 10.2 : Commit**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add resources/selfies/src/views/ResultView.vue && git commit -m 'feat: add ResultView with event branding in footer'"
```

---

## Task 11 : Premier build et vérification

- [ ] **Step 11.1 : Builder le projet Vue**

```bash
ssh audonia-vps "cd /home/audonia/docker/app/resources/selfies && npm run build"
```

Résultat attendu : `✓ built in Xs` sans erreur TypeScript. Fichiers générés dans `public/events/`.

- [ ] **Step 11.2 : Vérifier les fichiers générés**

```bash
ssh audonia-vps "ls /home/audonia/docker/app/public/events/"
```

Résultat attendu : `index.html`, `assets/` (avec fichiers JS et CSS).

- [ ] **Step 11.3 : Vérifier la route SPA**

```bash
curl -s https://www.audonia.fr/events/frames | head -5
```

Résultat attendu : `<!doctype html>` — le `index.html` Vue est servi.

- [ ] **Step 11.4 : Vérifier l'API event**

```bash
curl -s https://www.audonia.fr/api/events/test-event
```

Résultat attendu : `{"name":"Test Event","frameUrl":"/frames/test-event.png",...}`

- [ ] **Step 11.5 : Tester l'URL complète dans un navigateur**

Ouvrir : `https://www.audonia.fr/events/frames?event=test-event`

Résultat attendu : La LandingView affiche "Test Event" avec le bouton START.

- [ ] **Step 11.6 : Ajouter `public/events/` au `.gitignore`**

```bash
ssh audonia-vps "grep -q 'public/events' /home/audonia/docker/app/.gitignore || echo 'public/events/' >> /home/audonia/docker/app/.gitignore"
ssh audonia-vps "grep -q 'public/frames' /home/audonia/docker/app/.gitignore || echo 'public/frames/' >> /home/audonia/docker/app/.gitignore"
ssh audonia-vps "grep -q 'storage/app/events' /home/audonia/docker/app/.gitignore || echo 'storage/app/events/' >> /home/audonia/docker/app/.gitignore"
```

- [ ] **Step 11.7 : Commit final**

```bash
ssh audonia-vps "cd /home/audonia/docker/app && git add .gitignore && git commit -m 'chore: gitignore public/events, public/frames, storage/app/events'"
```

---

## Task 12 : Créer l'event Zeiss et déployer

- [ ] **Step 12.1 : Créer l'event Zeiss Atelier 1**

```bash
ssh audonia-vps "docker exec laravel-app php artisan event:create zeiss-atelier-1"
```

- [ ] **Step 12.2 : Personnaliser la config**

```bash
ssh audonia-vps "cat > /home/audonia/docker/app/storage/app/events/zeiss-atelier-1.json << 'EOF'
{
    \"name\": \"AUDONIA - Photobooth\",
    \"frameUrl\": \"/frames/zeiss-atelier-1.png\",
    \"accentColor\": \"#1A3C5E\",
    \"logo\": null
}
EOF"
```

- [ ] **Step 12.3 : Déposer le frame PNG Zeiss**

Depuis ta machine locale, déposer le fichier PNG :

```bash
scp /chemin/vers/zeiss-atelier-1.png audonia-vps:/home/audonia/docker/app/public/frames/zeiss-atelier-1.png
```

- [ ] **Step 12.4 : Tester l'URL finale**

Ouvrir dans un navigateur (mobile recommandé pour tester la caméra) :

```
https://www.audonia.fr/events/frames?event=zeiss-atelier-1
```

Vérifier :

- [ ] La landing affiche "Zeiss Atelier #1"
- [ ] Le bouton START est de la bonne couleur (`#1A3C5E`)
- [ ] La caméra s'ouvre dans le Booth
- [ ] Le frame PNG Zeiss apparaît en overlay
- [ ] Les 4 shots se capturent
- [ ] La photo finale affiche "Zeiss Atelier #1" en footer
- [ ] Le bouton DOWNLOAD fonctionne

---

## Workflow pour un nouvel événement (post-déploiement)

```bash
# 1. Créer la config
ssh audonia-vps "docker exec laravel-app php artisan event:create nouveau-client"

# 2. Éditer la config
ssh audonia-vps "nano /home/audonia/docker/app/storage/app/events/nouveau-client.json"

# 3. Déposer le PNG
scp nouveau-client.png audonia-vps:/home/audonia/docker/app/public/frames/

# 4. URL immédiatement accessible
# https://www.audonia.fr/events/frames?event=nouveau-client
```

**Pas de rebuild nécessaire** pour un nouvel événement — seulement si le code frontend change.
