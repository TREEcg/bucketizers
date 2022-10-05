import { readFile } from 'fs/promises';
import type { Quad, Quad_Object } from '@rdfjs/types';
import type { BasicInputType } from '@treecg/basic-bucketizer';
import { BasicBucketizer } from '@treecg/basic-bucketizer';
import type { GeospatialInputType } from '@treecg/geospatial-bucketizer';
import { GeospatialBucketizer } from '@treecg/geospatial-bucketizer';
import type { SubjectInputType } from '@treecg/subject-page-bucketizer';
import { SubjectPageBucketizer } from '@treecg/subject-page-bucketizer';
import type { SubstringInputType } from '@treecg/substring-bucketizer';
import { SubstringBucketizer } from '@treecg/substring-bucketizer';
import type { Bucketizer } from '@treecg/types';
import { LDES, RDF } from '@treecg/types';
import * as N3 from 'n3';
import * as Validator from 'rdf-validate-shacl';

interface Typed<T> {
  'type': T;
}

interface BucketizerOptions {
  'basic': BasicInputType;
  'substring': SubstringInputType;
  'subject': SubjectInputType;
  'geospatial': GeospatialInputType;
}

type TypedWithOptions<T extends keyof BucketizerOptions> = Typed<T> & BucketizerOptions[T];

function isGeoInputOptions(input: TypedWithOptions<keyof BucketizerOptions>): input is TypedWithOptions<'geospatial'> {
  return input.type === 'geospatial';
}

function isSubjectInputOptions(input: TypedWithOptions<keyof BucketizerOptions>): input is TypedWithOptions<'subject'> {
  return input.type === 'subject';
}

// TODO: make some kind of factory that is more easily extensible
export function createBucketizer(input: TypedWithOptions<keyof BucketizerOptions>, state?: any): Bucketizer {
  // Looks the same as the switch statement but ts type inference works better this way
  if (isGeoInputOptions(input)) {
    return GeospatialBucketizer.build(input, state);
  }
  if (isSubjectInputOptions(input)) {
    return SubjectPageBucketizer.build(input, state);
  }

  switch (input.type) {
    case 'basic':
      return BasicBucketizer.build(input, state);
    case 'substring':
      return SubstringBucketizer.build(input, state);
  }

  throw `No valid bucketizer found for type ${input.type}`;
}

async function loadTurtle(location: string): Promise<N3.Store> {
  const content = await readFile(location, { encoding: 'utf-8' });
  const parser = new N3.Parser();
  const quads = parser.parse(content);
  return new N3.Store(quads);
}

type LDESProps = 'bucketProperty' | 'pageSize' | 'bucketType' | 'bucketBase';
type TREEProps = 'path';
type TREE<P extends string = TREEProps> = `https://w3id.org/tree#${P}`;
type LDES<P extends string = LDESProps> = `https://w3id.org/ldes#${P}`;

type KeyMap = {[key in LDES | TREE]: [string, (item: Quad_Object, quads: Quad[]) => any]};

const keymap: KeyMap = {
  'https://w3id.org/ldes#bucketProperty': ['bucketProperty', x => x.value],
  'https://w3id.org/ldes#bucketType': ['type', x => x.value.replace('https://w3id.org/ldes#', '')],
  'https://w3id.org/ldes#bucketBase': ['bucketBase', x => x.value],
  'https://w3id.org/ldes#pageSize': ['pageSize', x => Number.parseInt(x.value)],
  'https://w3id.org/tree#path': ['propertyPath', (x, quads) => x.termType === 'Literal' ? x.value : quads],
};

export async function getValidShape(ld: Quad[]): Promise<N3.Term | void> {
  const shapeData = await loadTurtle(`${__dirname}/shape.ttl`);
  const validator = new Validator(shapeData);
  const data = new N3.Store(ld);
  const factory = N3.DataFactory;

  const subjects = data.getSubjects(RDF.terms.type, LDES.terms.BucketizeStrategy, null);

  const shape = factory.namedNode('http://schema.org/BucketizeShape');

  for (const subject of subjects) {
    validator.validate(data);
    if (validator.nodeConformsToShape(subject, shape)) {
      return subject;
    }
  }
}

export async function createBucketizerLD(ld: Quad[], state?: any): Promise<Bucketizer> {
  const validShape = await getValidShape(ld);
  if (!validShape) {
    throw new Error('No valid shape found!');
  }

  const quads = ld.filter(quad => quad.subject.equals(validShape));
  const config: any = {};

  for (const quad of quads) {
    const map = keymap[<LDES>quad.predicate.value];
    if (!map) {
      continue;
    }

    const [key, mapper] = map;
    config[key] = mapper(quad.object, ld);
  }

  return createBucketizer(config, state);
}

