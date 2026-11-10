# skills-site

Composite GitHub Action that turns a repository of `SKILL.md` files into a static catalog site.

It scans the repository for `**/SKILL.md`, reads the YAML frontmatter, and writes a ready-to-deploy site with search, category filters, and an EN/PT interface.

## Usage

```yaml
name: Deploy site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
        with:
          enablement: true
      - id: site
        uses: 14NGiestas/skills-site@v1
        with:
          title: "My Skills"
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${{ steps.site.outputs.site-path }}

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Enable Pages once under **Settings → Pages → Source: GitHub Actions**.

Pin the action to the major tag (`@v1`). The tag moves only for backward-compatible changes.

## Inputs

| Input | Default | Description |
| :--- | :--- | :--- |
| `source` | `.` | Repository/path containing `SKILL.md` files. |
| `output` | `_site` | Directory where the generated site is written. |
| `title` | `AI Skills` | Site title. |
| `repository` | caller repo | `owner/repo` used for GitHub and raw links. |
| `ref` | caller ref | Git ref used for raw links. |

## Outputs

| Output | Description |
| :--- | :--- |
| `site-path` | Path to the generated site (use it as the Pages artifact path). |

## How skills are discovered

- Every `**/SKILL.md` is one skill.
- `name` and `description` come from the YAML frontmatter.
- The display title comes from the first `# Heading`.
- Language comes from the top-level folder (`en`, `pt-br` → `pt`, `es`, `fr`, `de`); otherwise `en`.
- Category comes from `metadata.category` (string or `{en, pt}` map), then known folders, then the first folder name.
- Grouping/order can be set with `metadata.group` and `metadata.order`.

## License

MIT
