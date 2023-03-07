import { readFile } from 'fs/promises';
import type { Quad } from '@rdfjs/types';
import type { Bucketizer } from '@treecg/types';
import { LDES, RDF } from '@treecg/types';
import * as N3 from 'n3';
import * as Validator from 'rdf-validate-shacl';
import { Term } from '@rdfjs/types';
import { Configs, FACTORY } from '..';

interface Typed {
  'type': string;
}


export function createBucketizer(input: Configs & Typed, state?: any): Bucketizer {
  return FACTORY.build(input, input.type, state);
}

async function loadTurtle(location: string): Promise<N3.Store> {
  const content = await readFile(location, { encoding: 'utf-8' });
  const parser = new N3.Parser();
  const quads = parser.parse(content);
  return new N3.Store(quads);
}


export async function getValidShape(ld: Quad[], subject?: Term): Promise<N3.Term | void> {
  const shapeData = await loadTurtle(`${__dirname}/shape.ttl`);
  const validator = new Validator(shapeData);
  const data = new N3.Store(ld);
  const factory = N3.DataFactory;

  const subjects = data.getSubjects(RDF.terms.type, LDES.terms.BucketizeStrategy, null);

  const shape = factory.namedNode('http://schema.org/BucketizeShape');

  for (const sub of subjects) {
    if (subject && sub.value !== subject.value) {
      continue;
    }
    validator.validate(data);
    if (validator.nodeConformsToShape(sub, shape)) {
      return sub;
    }
  }
}

export async function createBucketizerLD(ld: Quad[], subject?: Term, state?: any): Promise<Bucketizer> {
  const validShape = await getValidShape(ld, subject);
  if (!validShape) {
    throw new Error('No valid shape found!');
  }

  return FACTORY.buildLD(ld, validShape, state);
}

