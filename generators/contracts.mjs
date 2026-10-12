// Artifact-first EventCatalog generator: reads each repo's committed
// contracts/events/*.json — never its source code. Any language that commits
// conformant artifacts (with x-eventcatalog metadata) shows up in the catalog.
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import utils from '@eventcatalog/sdk';

const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function readMetadata(schema, location) {
  const meta = schema?.['x-eventcatalog'];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new Error(`${location}: x-eventcatalog must be an object`);
  }
  for (const field of ['id', 'version']) {
    if (typeof meta[field] !== 'string' || !identifier.test(meta[field])) {
      throw new Error(`${location}: x-eventcatalog.${field} must be a non-empty identifier`);
    }
  }
  for (const field of ['name', 'summary']) {
    if (meta[field] !== undefined && typeof meta[field] !== 'string') {
      throw new Error(`${location}: x-eventcatalog.${field} must be a string`);
    }
  }
  for (const field of ['producers', 'consumers', 'owners']) {
    if (
      meta[field] !== undefined
      && (!Array.isArray(meta[field]) || meta[field].some((value) => typeof value !== 'string' || !identifier.test(value)))
    ) {
      throw new Error(`${location}: x-eventcatalog.${field} must be an array of identifiers`);
    }
  }
  return meta;
}

// A repository's autocatalog.consumes.json: the events its services consume,
// by EventCatalog id. The producer does not have to list them.
export function readDeclarations(text, location) {
  const declarations = JSON.parse(text)?.consumes;
  if (!Array.isArray(declarations)) throw new Error(`${location}: consumes must be an array`);
  return declarations.map((declaration, index) => {
    if (typeof declaration?.service !== 'string' || !identifier.test(declaration.service)) {
      throw new Error(`${location}: consumes[${index}].service must be an identifier`);
    }
    const [domainId, eventId, ...rest] = String(declaration.event ?? '').split('/');
    if (rest.length > 0 || !identifier.test(domainId ?? '') || !identifier.test(eventId ?? '')) {
      throw new Error(`${location}: consumes[${index}].event must be domain/id`);
    }
    return { service: declaration.service, event: eventId };
  });
}

export default async (_, { repos, consumers = [], domain }) => {
  const projectDir = process.env.PROJECT_DIR || process.cwd();
  const { writeEvent, addSchemaToEvent, writeService, writeDomain } = utils(projectDir);

  // full replacement: everything under this domain is generated, so retired
  // contracts disappear instead of surviving as stale pages
  rmSync(join(projectDir, 'domains', domain.id), { recursive: true, force: true });

  const servicePath = (id) => join('../', 'domains', domain.id, 'services', id);
  const services = new Map();
  const service = (id) => {
    if (!services.has(id)) services.set(id, { sends: [], receives: [] });
    return services.get(id);
  };

  const seen = new Map(); // event id → repo that defined it
  const versions = new Map(); // event id → version
  for (const repoPath of repos) {
    const repo = basename(repoPath);
    const dir = join(projectDir, repoPath, 'contracts', 'events');
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
      const location = `${repo}/contracts/events/${file}`;
      const schema = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const meta = readMetadata(schema, location);
      if (seen.has(meta.id)) {
        throw new Error(`event id "${meta.id}" defined by both ${seen.get(meta.id)} and ${repo}`);
      }
      seen.set(meta.id, repo);
      const { id, version } = meta;
      const producer = (meta.producers ?? [])[0];

      await writeEvent(
        {
          id,
          name: meta.name ?? id,
          version,
          summary: meta.summary ?? '',
          markdown: [
            `Generated from \`${repo}/contracts/events/${file}\`.`,
            '## Payload contract',
            'This JSON Schema validates the event payload after a transport adapter removes any broker envelope. The same payload can travel through Kafka, NATS, SQS/SNS, RabbitMQ, EventBridge, Redis Streams, or the local NDJSON adapter.',
            '<SchemaViewer file="schema.json" title="Schema" maxHeight="500" />',
            '## Transport contract',
            'Topics, subjects, queues, routing keys, message attributes, retries, and acknowledgement policies belong to the transport contract. AsyncAPI can publish those channel and protocol details alongside this payload schema.',
          ].join('\n\n'),
          schemaPath: 'schema.json',
        },
        { path: producer ? join(servicePath(producer), 'events', id) : id, override: true }
      );
      await addSchemaToEvent(id, { fileName: 'schema.json', schema: JSON.stringify(schema, null, 2) }, version);

      for (const s of meta.producers ?? []) service(s).sends.push({ id, version });
      for (const s of meta.consumers ?? []) service(s).receives.push({ id, version });
      versions.set(id, version);
      console.log(`documented ${id} (v${version}) from ${repo}`);
    }
  }

  // Consumers that declare themselves in their own repository.
  for (const repoPath of consumers) {
    const location = `${basename(repoPath)}/autocatalog.consumes.json`;
    const text = readFileSync(join(projectDir, repoPath, 'autocatalog.consumes.json'), 'utf8');
    for (const { service: id, event } of readDeclarations(text, location)) {
      const version = versions.get(event);
      if (!version) {
        console.warn(`${location}: ${event} is not in the catalog`);
        continue;
      }
      const { receives } = service(id);
      if (!receives.some((ref) => ref.id === event)) receives.push({ id: event, version });
    }
  }

  for (const [id, { sends, receives }] of services) {
    const role = [
      sends.length > 0 ? `Publishes ${sends.length} contracted event${sends.length === 1 ? '' : 's'}.` : '',
      receives.length > 0 ? `Consumes ${receives.length} contracted event${receives.length === 1 ? '' : 's'}.` : '',
    ].filter(Boolean).join(' ');
    const explanation = [
      sends.length > 0 ? 'Its runtime schemas generate committed payload artifacts before a transport adapter delivers each event.' : '',
      receives.length > 0 ? 'It reads committed payload artifacts and validates each event after a transport adapter removes the broker envelope.' : '',
    ].filter(Boolean).join(' ');
    await writeService(
      {
        id,
        name: id,
        version: '1.0.0',
        summary: role,
        markdown: `${role} ${explanation}`,
        ...(sends.length > 0 && { sends }),
        ...(receives.length > 0 && { receives }),
      },
      { path: servicePath(id), override: true }
    );
  }

  await writeDomain(
    {
      id: domain.id,
      name: domain.name,
      version: domain.version,
      summary: domain.summary ?? '',
      markdown: domain.markdown ?? '',
      services: [...services.keys()].map((id) => ({ id, version: 'latest' })),
    },
    { override: true }
  );

  console.log(`contracts generator: ${services.size} service(s) from ${repos.length} repo(s)`);
};
