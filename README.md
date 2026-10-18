# cbd-catalog

The company catalog: **https://jagreehal.github.io/cbd-catalog/**

One site over the public repositories tagged `cbd-publisher`, built by
[autocatalog](https://www.npmjs.com/package/autocatalog). Each build clones
them with history and renders:

- their `docs/**/*.md`, with the owner, the last git change and backlinks, and
  search across the repositories
- the events, services, owners and fields their `contracts/` declare
- a Markdown twin of every doc at `/<repo>/<doc>.md`, for agents
- [`llms.txt`](https://jagreehal.github.io/cbd-catalog/llms.txt), the docs listed for an agent to read
- [`contracts/docs-manifest.json`](https://jagreehal.github.io/cbd-catalog/contracts/docs-manifest.json),
  every doc and who links to it. Each publisher's docs check reads it to catch
  broken cross-repo links.
- [`catalog.json`](https://jagreehal.github.io/cbd-catalog/catalog.json), every
  repository's events and declared consumers. A producer's pull request reads
  it with `autocatalog drift --consumers` to name the consumers a change breaks.

A consumer can declare what it reads in its own `autocatalog.consumes.json`,
and the build adds it to the catalog.

This used to be two sites, a Starlight docs index in
[cbd-docs-site](https://github.com/jagreehal/cbd-docs-site) and EventCatalog
here. They read the same repositories, so one build now does both. Old
cbd-docs-site links redirect here.

This repo owns no documents or contracts, and publishers build without it.
GitHub Actions rebuilds it hourly, on push, and when you run the workflow by hand.

```sh
pnpm install
pnpm run build      # clone enrolled repos into .autocatalog/repos and build dist/
pnpm run manifest   # write dist/contracts/docs-manifest.json
pnpm run dev        # the same site with live reload
```

## The six repositories

| Repo | Role |
|---|---|
| [cbd-handbook](https://github.com/jagreehal/cbd-handbook) | Owns the convention: docs frontmatter schema, docs check, company policy |
| [cbd-payments-service](https://github.com/jagreehal/cbd-payments-service) | TypeScript producer: OpenAPI, event JSON Schemas, runbook |
| [cbd-dashboard](https://github.com/jagreehal/cbd-dashboard) | TypeScript consumer: generates a typed client from the pinned OpenAPI |
| [cbd-reporter](https://github.com/jagreehal/cbd-reporter) | Python consumer: validates events against the pinned JSON Schemas |
| [cbd-docs-site](https://github.com/jagreehal/cbd-docs-site) | Retired: redirects to cbd-catalog |
| [cbd-catalog](https://github.com/jagreehal/cbd-catalog) | Aggregator: [the one site](https://jagreehal.github.io/cbd-catalog/) over the enrolled repos: docs index, `llms.txt`, docs manifest, `catalog.json` |

Consumers fetch committed artifacts over HTTPS at a pinned tag. The
aggregator finds publishers by the `cbd-publisher` GitHub topic.

The pattern and the argument behind it: [convention-based-design](https://github.com/jagreehal/convention-based-design).
