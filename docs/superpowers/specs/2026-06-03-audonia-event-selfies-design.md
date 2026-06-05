# Audonia Event Selfies — Design Spec
**Date :** 2026-06-03  
**Statut :** Approuvé

---

## Contexte

Fork de [SelfSnap](https://github.com/darladavid/selfsnap-project) adapté pour l'activité événementielle d'Audonia. Chaque événement client dispose d'une URL dédiée qui charge automatiquement le bon overlay (frame PNG) et le branding correspondant. Déployé sur le VPS Audonia, intégré au Laravel/Statamic existant.

---

## URL Scheme

```
https://www.audonia.fr/events/frames?event=zeiss-atelier-1
```

- Le paramètre `?event=` est le slug unique de l'événement
- Slug absent ou invalide → page d'erreur claire
- Pas de sélection de frame par l'utilisateur — tout est automatique

---

## Architecture

```
audonia.fr/events/frames?event={slug}
        │
        ▼
   Nginx (laravel-webserver container)
        │
        ▼
   Laravel (laravel-app container) — /home/audonia/docker/app
   ├── routes/web.php
   │   ├── GET /api/events/{slug}          → EventFrameController@show
   │   └── GET /events/frames/{any?}       → sert public/events/index.html (SPA catch-all)
   ├── app/Http/Controllers/EventFrameController.php
   ├── storage/app/events/{slug}.json      ← config par événement
   └── public/
       ├── events/                         ← build Vite Vue (gitignored)
       └── frames/                         ← PNG overlays (ajoutés manuellement)
```

---

## Backend Laravel

### Routes (`routes/web.php`)

```php
Route::get('/api/events/{slug}', [EventFrameController::class, 'show']);

Route::get('/events/frames/{any?}', function () {
    return file_get_contents(public_path('events/index.html'));
})->where('any', '.*');
```

La route SPA est déclarée **après** les routes Statamic pour ne pas interférer. `/events/frames/*` est un chemin libre dans Statamic.

### `EventFrameController`

Lit `storage/app/events/{slug}.json`. Retourne 404 si le fichier n'existe pas.

```php
public function show(string $slug)
{
    $path = storage_path("app/events/{$slug}.json");
    if (!file_exists($path)) {
        return response()->json(['error' => 'Event not found'], 404);
    }
    return response()->json(json_decode(file_get_contents($path), true));
}
```

### Format config événement (`storage/app/events/{slug}.json`)

```json
{
  "name": "Zeiss Atelier #1",
  "frameUrl": "/frames/zeiss-atelier-1.png",
  "accentColor": "#1A3C5E",
  "logo": "/images/clients/zeiss-logo.png"
}
```

| Champ | Description |
|---|---|
| `name` | Nom affiché dans l'UI et sur la photo finale |
| `frameUrl` | Chemin relatif vers le PNG overlay dans `public/` |
| `accentColor` | Couleur d'accent UI (boutons, highlights) |
| `logo` | Logo client affiché en footer de la photo |

### Commande Artisan helper

```bash
php artisan event:create zeiss-atelier-1
```
Crée `storage/app/events/zeiss-atelier-1.json` avec des valeurs par défaut.

---

## Frontend Vue (fork de selfsnap-web)

### Localisation dans le repo

```
/home/audonia/docker/app/
  resources/
    selfies/              ← projet Vue (fork selfsnap-web)
      src/
        composables/
          useEvent.ts     ← NEW : charge la config event depuis l'API
        views/
          LandingView.vue ← modifié : affiche nom event + branding
          BoothView.vue   ← modifié : frame chargée auto, pas de settings
          ResultView.vue  ← modifié : footer = nom event + logo Audonia
          ErrorView.vue   ← NEW : slug absent/invalide
        router.ts
        App.vue
      vite.config.ts
      package.json
  public/
    events/               ← build output (gitignored)
    frames/               ← PNG overlays
```

### Vite config

```ts
build: {
  outDir: '../../public/events',
  emptyOutDir: true,
}
base: '/events/frames/'
```

### Composable `useEvent.ts`

- Lit `?event=` depuis `window.location.search`
- Appelle `GET /api/events/{slug}`
- Expose `{ name, frameUrl, accentColor, logo, loading, error }`
- Si slug absent ou API 404 → redirige vers `ErrorView`

### Vues modifiées vs original

| Vue | Changement |
|---|---|
| `LandingView` | Affiche `event.name`, couleur accent, bouton START |
| `SettingsView` | **Supprimée** — remplacée par chargement automatique |
| `BoothView` | Frame chargée depuis `event.frameUrl`, filtre par défaut `none` |
| `ResultView` | Footer : `event.name` + date + logo Audonia (au lieu de "SelfSnap!") |
| `ErrorView` | **Nouvelle** : message si event introuvable |

### Ce qui reste identique à l'original

- Logique de capture 4 shots (canvas, sessionStorage)
- Layout system (`compute4GridSlots`)
- Countdown timer
- Download / Web Share API
- Privacy-first : aucune image quittant le navigateur

---

## Déploiement

### Premier déploiement

```bash
# Sur le VPS, dans le container laravel-app
ssh audonia-vps "docker exec laravel-app bash -c 'cd resources/selfies && npm install && npm run build'"

# Créer le dossier frames
ssh audonia-vps "mkdir -p /home/audonia/docker/app/public/frames"

# Créer un event
ssh audonia-vps "docker exec laravel-app php artisan event:create zeiss-atelier-1"

# Déposer le PNG via SFTP
scp zeiss-atelier-1.png audonia-vps:/home/audonia/docker/app/public/frames/
```

### Mise à jour frontend

```bash
ssh audonia-vps "docker exec laravel-app bash -c 'cd resources/selfies && npm run build'"
```

### Ajouter un nouvel événement

1. Créer la config : `php artisan event:create {slug}`
2. Éditer `storage/app/events/{slug}.json`
3. Déposer le PNG dans `public/frames/`
4. L'URL est immédiatement accessible

---

## Fichiers gitignored dans le repo Laravel

```
public/events/
public/frames/
storage/app/events/
```

Les frames PNG et configs events sont spécifiques au VPS de prod, pas versionnées.

---

## Hors scope

- Interface d'administration web pour gérer les events
- Authentification / accès restreint par event
- Upload de frames via l'UI
- Analytics par event
- Plusieurs frames au choix par event
