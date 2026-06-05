# Audonia Event Selfies

Fork de SelfSnap adapté pour les événements clients Audonia. Photo booth 4 shots, browser-only, déployé sur le VPS Audonia intégré au Laravel/Statamic existant.

## Spec de design

[docs/superpowers/specs/2026-06-03-audonia-event-selfies-design.md](docs/superpowers/specs/2026-06-03-audonia-event-selfies-design.md)

---

## Structure du repo

```
selfsnap-project/         ← code source original (référence, ne pas modifier)
  selfsnap-web/           ← frontend Vue original
  src/                    ← lambdas AWS originales (non utilisées)

docs/
  superpowers/specs/      ← specs de design
```

## Ce qu'on construit

Le code de production va dans le **repo Laravel du VPS**, pas ici.

- **Frontend Vue** → `resources/selfies/` dans le repo Laravel
- **Backend** → routes + controller dans le Laravel existant
- **Frames PNG** → `public/frames/` sur le VPS (pas versionné)

---

## VPS Audonia

```bash
ssh audonia-vps
# Projet Laravel : /home/audonia/docker/app
# Container app  : laravel-app
# Container nginx: laravel-webserver
```

Pour toute opération VPS, charger le skill `audonia-vps`.

---

## URL scheme

```
https://www.audonia.fr/events/frames?event={slug}
```

- `?event=zeiss-atelier-1` → charge `storage/app/events/zeiss-atelier-1.json`
- Frame PNG → `public/frames/zeiss-atelier-1.png`

---

## Stack frontend (fork selfsnap-web)

- Vue 3 + TypeScript + Vite + Tailwind CSS
- Build output : `public/events/` (gitignored sur le VPS)
- `base` Vite : `/events/frames/`
- `outDir` Vite : `../../public/events`

## Stack backend (Laravel existant)

- Laravel + Statamic sur PHP 8.3
- Route SPA catch-all : `GET /events/frames/{any?}`
- Route API : `GET /api/events/{slug}`
- Config events : `storage/app/events/{slug}.json`

---

## Vues Vue (vs original SelfSnap)

| Vue | Statut | Notes |
|---|---|---|
| `LandingView` | Modifiée | Affiche nom event + couleur accent |
| `SettingsView` | Supprimée | Remplacée par chargement auto |
| `BoothView` | Modifiée | Frame auto depuis API |
| `ResultView` | Modifiée | Footer = nom event + logo Audonia |
| `ErrorView` | Nouvelle | Slug absent ou event introuvable |

## Composable clé

`useEvent.ts` — lit `?event=` → appelle `/api/events/{slug}` → expose `{ name, frameUrl, accentColor, logo, loading, error }`

---

## Commandes utiles

```bash
# Builder le frontend (sur le VPS)
ssh audonia-vps "docker exec laravel-app bash -c 'cd resources/selfies && npm run build'"

# Créer un nouvel event
ssh audonia-vps "docker exec laravel-app php artisan event:create {slug}"

# Déposer un frame PNG
scp {slug}.png audonia-vps:/home/audonia/docker/app/public/frames/

# Logs
ssh audonia-vps "docker logs laravel-app --tail=50"
```

---

## Ce qui ne change pas vs SelfSnap original

- Capture 4 shots séquentiels avec countdown
- Layout `compute4GridSlots()` (1080×1920, grille 2×2)
- Tout dans le navigateur — aucune image uploadée
- Download + Web Share API
- sessionStorage pour les shots entre vues
