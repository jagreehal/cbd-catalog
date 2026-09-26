// Artifact-first EventCatalog generator for the docs/ root. Reads the same
// committed docs/**/*.md that docs-site reads and writes them as EventCatalog
// custom docs. The convention is the input; the reading surface is replaceable.
//
// Requires an EventCatalog Starter or Scale licence to render at /docs/custom.
// Generation is unlicensed: the files are written either way, and a free
// catalog simply does not route them.
import { globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';

const frontmatter = /^---\n(.*?)\n---\n/s;

// Structural parse only. cbd-handbook/contracts/docs-frontmatter.json is the
// contract, and the publishing repo's own CI enforces it (rule 3). Re-running
// the schema here would make the catalog a second gatekeeper for files it does
// not own.
export function readDoc(text, location) {
  const match = frontmatter.exec(text);
  if (!match) throw new Error(`${location}: no frontmatter`);
  const data = parse(match[1]) ?? {};
  for (const field of ['title', 'owner']) {
    if (typeof data[field] !== 'string' || data[field] === '') {
      throw new Error(`${location}: ${field} must be a non-empty string`);
    }
  }
  return { data, body: text.slice(match[0].length).trim() };
}

// A doc is addressed by its path, never by a declared id, so the same id works
// in docs-site, in the manifest, and here:
//   cbd-payments-service/docs/ops/replay.md -> cbd-payments-service/ops/replay
export const docId = (repo, file) => `${repo}/${file.replace(/^docs\//, '').replace(/\.md$/, '')}`;

export const summarise = (body) => {
  const paragraph = (body.split(/\n\s*\n/).find((block) => !block.startsWith('#')) ?? '').replace(/\s+/g, ' ').trim();
  const sentence = /^.*?[.?!](?=\s|$)/.exec(paragraph)?.[0] ?? paragraph;
  // never cut a word in half: readers see this line in the sidebar and search
  return sentence.length <= 200 ? sentence : `${sentence.slice(0, 200).replace(/\s\S*$/, '')}…`;
};

// `related:` is a declared cross-repository edge, not a filesystem path. The
// catalog resolves it to its own route the same way docs-site resolves it to
// its own.
export const relatedSection = (related = []) =>
  related.length === 0
    ? ''
    : ['## Related', ...related.map((id) => `- [${id}](/docs/custom/${id})`)].join('\n');

// @eventcatalog/sdk 2.26's writeCustomDoc leaves `markdown` in the destructured
// frontmatter, so it writes the whole body twice — once as YAML, once as body.
// Every other writer in the SDK strips it. Writing the file here is smaller than
// the workaround, and the shape is the documented custom-doc shape.
const writeDoc = (path, { markdown, ...frontmatter }) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\n${stringify(frontmatter)}---\n\n${markdown}\n`);
};

export default async (_, { repos }) => {
  const projectDir = process.env.PROJECT_DIR || process.cwd();

  // full replacement: a deleted doc disappears instead of surviving as a stale
  // page, the same rule the contracts generator applies to its domain
  rmSync(join(projectDir, 'docs'), { recursive: true, force: true });

  let count = 0;
  for (const repoPath of repos) {
    const repo = basename(repoPath);
    for (const file of globSync('docs/**/*.md', { cwd: join(projectDir, repoPath) }).sort()) {
      const location = `${repo}/${file}`;
      const { data, body } = readDoc(readFileSync(join(projectDir, repoPath, file), 'utf8'), location);
      const id = docId(repo, file);

      // ponytail: custom docs are .mdx, so authored markdown is parsed as MDX.
      // Bare `<` or `{` outside a code fence will fail the build. Pre-escape
      // here if a publishing repo ever hits it.
      writeDoc(join(projectDir, 'docs', `${id}.mdx`), {
        title: data.title,
        summary: summarise(body),
        owners: [data.owner],
        markdown: [body, relatedSection(data.related), `Published by \`${location}\`.`]
          .filter(Boolean)
          .join('\n\n'),
      });
      count += 1;
    }
  }

  console.log(`docs generator: ${count} doc(s) from ${repos.length} repo(s)`);
};
