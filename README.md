# Daad — আরবি ভাষা

An interactive, gamified web app for learning Arabic (Bengali-medium), covering
vocabulary, grammar (Sarf · Nahwu · Balagah) and Qur'anic language.

## Structure

- **Frontend**: `index.html` + `css/style.css` + plain ES modules in `js/`
  (no bundler). `js/main.js` exposes every inline-`onclick` handler on `window`.
- **Backend**: Vercel serverless functions in `api/` (auth, progress, TTS,
  leaderboard) with `lib/` for the database and session helpers.
- **Content**: all lessons, stories, icons and the glossary live as editable
  JSON in `content/` and are compiled into `js/content.generated.js`.
  See [content/README.md](content/README.md).

## Editing content

Edit the files in `content/`, then rebuild and commit both:

```bash
npm run build:content
git add -A && git commit -m "Update content" && git push
```

`npm test` validates the content and checks the generated file is up to date.

## Deployment

Deployed on Vercel from this repo — every push to `main` auto-deploys to
production. `vercel.json` and `package.json` hold the config.
