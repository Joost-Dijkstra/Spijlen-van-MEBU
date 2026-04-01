# Spijlzoeker

Lokale en GitHub Pages-webapp om op spijlcode te zoeken in een opgeschoonde dataset van Spijl in Stijl.

## Lokaal gebruiken

- Dubbelklik op `Spijlzoeker openen.vbs`
- Stoppen kan met `Spijlzoeker stoppen.vbs`

## Data verversen

- Run `node scrape-spijlen.js`
- Commit daarna de bijgewerkte `spijlen.json`

## GitHub Pages

- Push naar `main`
- In GitHub: `Settings` > `Pages` > `Source` op `GitHub Actions` zetten als dat nog niet automatisch gebeurt
- De workflow in `.github/workflows/deploy-pages.yml` publiceert daarna de site
