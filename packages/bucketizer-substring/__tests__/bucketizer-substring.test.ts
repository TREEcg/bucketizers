import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import { SubstringBucketizer } from '../lib/SubstringBucketizer';

describe('ldes-substring-bucketizer', () => {
  let quads: RDF.Quad[];
  let factory: RDF.DataFactory;
  let bucketizer: SubstringBucketizer;
  let targetNode: RDF.NamedNode;
  let bucketNode: RDF.NamedNode;

  beforeAll(async () => {
    factory = new DataFactory();
    bucketizer = new SubstringBucketizer('(<http://www.w3.org/2000/01/rdf-schema#label>)', 20);
    targetNode = factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label');
    bucketNode = factory.namedNode('https://w3id.org/ldes#bucket');
  });

  beforeEach(async () => {
    quads = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ];
  });

  it('adds bucket triples for each substring', async () => {
    bucketizer.bucketize(quads, 'http://example.org/id/123#456');
    let bucketCounter = 0;

    quads.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        bucketCounter++;
      }
    });

    expect(bucketCounter).toBe(7);
  });

  it('adds bucket triples with incrementing substrings', async () => {
    const substrings: string[] = ['j', 'jo', 'joh', 'john', 'd', 'do', 'doe'];
    bucketizer.bucketize(quads, 'http://example.org/id/123#456');

    quads.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(substrings).toContain(quad.object.value);
      }
    });
  });

  // eslint-disable-next-line mocha/no-synchronous-tests
  it('should throw an error when target predicate could not be found', () => {
    quads = [quads[0]];
    expect(() => bucketizer.bucketize(quads, 'http://example.org/id/123#456')).toThrow();
  });
});