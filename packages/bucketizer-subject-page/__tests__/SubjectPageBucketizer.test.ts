import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import { SubjectPageBucketizer } from '../lib/SubjectPageBucketizer';

describe('bucketizer-subject-page', () => {
  let member: RDF.Quad[];
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = factory.namedNode('https://w3id.org/ldes#bucket');

  const bucketizerOptions: any = {
    propertyPath: '(<http://purl.org/dc/terms/isVersionOf>)',
    pageSize: 20,
  };

  beforeEach(async () => {
    member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];
  });

  it('should be a function', async () => {
    expect(SubjectPageBucketizer).toBeInstanceOf(Function);
  });

  it('should be a constructor', async () => {
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    expect(bucketizer)
      .toBeInstanceOf(SubjectPageBucketizer);
  });

  it('should apply fallback function when property path is not found', async () => {
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('Test'),
      ),
    ];

    bucketizer.bucketize(newMember, 'http://example.org/id/123#456');

    const bucketTriple: RDF.Quad = newMember.find(quad => quad.predicate.equals(bucketNode))!;
    expect(bucketTriple.object.value).toEqual('bucketless-0');
  });

  it('should add one or more bucket triples to a member', async () => {
    const originalLength = member.length;
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    bucketizer.bucketize(member, 'http://example.org/id/123#456');

    const bucketQuads = member.filter(quad => quad.predicate.equals(bucketNode))!;

    expect(bucketQuads.length).toBeGreaterThan(0);
  });

  it('should throw an error when property path option is not set', async () => {
    let ok, err;
    try {
      ok = await SubjectPageBucketizer.build({});
    } catch(e) {
      err = e;
    }

    expect(ok).toBeUndefined();
    expect(err).toEqual("expected propertyPath in options but found undefined");
  });

  it('should be able to export its current state', async () => {
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    const currentState = bucketizer.exportState();

    expect(currentState).toHaveProperty('hypermediaControls');
    expect(currentState).toHaveProperty('propertyPathPredicates');
    expect(currentState).toHaveProperty('bucketizerOptions');
    expect(currentState).toHaveProperty('bucketlessPageNumber');
    expect(currentState).toHaveProperty('bucketlessPageMemberCounter');
  });

  it('should import a previous state', async () => {
    const propertyPathPredicates = [
      factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
    ];

    const state = {
      hypermediaControls: [],
      propertyPathPredicates,
    };

    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions, state);

    expect(bucketizer.getPropertyPathPredicates()).toEqual(state.propertyPathPredicates);
    expect(bucketizer.getBucketHypermediaControlsMap()).toEqual(new Map(state.hypermediaControls));
  });
});
