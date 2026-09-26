# cbd-catalog

The company contract catalog: **https://jagreehal.github.io/cbd-catalog/**

EventCatalog over the public repositories tagged `cbd-publisher`. The
generators read events from `contracts/events/*.json`, with `x-eventcatalog`
metadata, and pages from `docs/`. This repo names no publisher.

```sh
pnpm install
pnpm run repos      # clone enrolled repos into repos/ (needs gh)
pnpm run generate && pnpm run dev
```

## The six repositories

| Repo | Role |
|---|---|
| [cbd-handbook](https://github.com/jagreehal/cbd-handbook) | Owns the convention: docs frontmatter schema, docs check, company policy |
| [cbd-payments-service](https://github.com/jagreehal/cbd-payments-service) | TypeScript producer: OpenAPI, event JSON Schemas, runbook |
| [cbd-dashboard](https://github.com/jagreehal/cbd-dashboard) | TypeScript consumer: generates a typed client from the pinned OpenAPI |
| [cbd-reporter](https://github.com/jagreehal/cbd-reporter) | Python consumer: validates events against the pinned JSON Schemas |
| [cbd-docs-site](https://github.com/jagreehal/cbd-docs-site) | Aggregator: [docs index](https://jagreehal.github.io/cbd-docs-site/) over the enrolled repos |
| [cbd-catalog](https://github.com/jagreehal/cbd-catalog) | Aggregator: [EventCatalog](https://jagreehal.github.io/cbd-catalog/) over the enrolled repos |

Consumers fetch committed artifacts over HTTPS at a pinned tag. The
aggregators find publishers by the `cbd-publisher` GitHub topic.

The pattern and the argument behind it: [convention-based-design](https://github.com/jagreehal/convention-based-design).
