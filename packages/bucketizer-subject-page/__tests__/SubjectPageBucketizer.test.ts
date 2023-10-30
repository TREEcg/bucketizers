import { describe, expect, test, it } from "@jest/globals";
import type * as RDF from '@rdfjs/types';
import { Parser } from 'n3';
import { DataFactory } from 'rdf-data-factory';
import { SubjectInputType, SubjectPageBucketizer, SubjectPageBucketizerFactory } from '../lib/SubjectPageBucketizer';

describe('bucketizer-subject-page', () => {
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = factory.namedNode('https://w3id.org/sds#bucket');

  const bucketizerOptions: any = {
    propertyPath: '<http://purl.org/dc/terms/isVersionOf>',
    bucketBase: '',
    pageSize: 20,
    root: "root"
  };

  test("factory parsing to LD", async () => {
    const fact = new SubjectPageBucketizerFactory()
    const ld = new Parser().parse(`
@prefix ex: <http://example.org/ns#> .
@prefix ldes: <https://w3id.org/ldes#> .
@prefix tree: <https://w3id.org/tree#> .
@prefix : <http://time.is/ns#> .

ex:BucketizeStrategy
    ldes:bucketType ldes:subject;
    ldes:bucketProperty ldes:bucket2;
    tree:path "<http://time.is/ns#y>";
    ldes:maxRelations 2;
    ldes:pageSize 10.
`);
    const mConfig = fact.ldConfig(ld, factory.namedNode("http://example.org/ns#BucketizeStrategy"));

    expect(mConfig).not.toBeFalsy();

    const config = <SubjectInputType>mConfig!;

    expect(config.maxRelations).toBe(2);
    expect(config.pageSize).toBe(10);

    const bucketizer = fact.build(config);
    expect((<any>bucketizer).maxRelations).toBe(2);
  });

  it('should be a function', async () => {
    expect(SubjectPageBucketizer).toBeInstanceOf(Function);
  });

  it('should be a constructor', async () => {
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    expect(bucketizer).toBeInstanceOf(SubjectPageBucketizer);
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

    const buckets = bucketizer.bucketize(newMember, 'http://example.org/id/123#456');

    const bucketTriple: RDF.Quad = buckets.find(quad => quad.predicate.equals(bucketNode))!;
    expect(bucketTriple.object.value).toEqual('bucketless-0');
  });

  it('should add one or more bucket triples to a member', () => {
    const member: RDF.Quad[] = new Parser().parse(`
      <http://example.org/id/123#456> <http://purl.org/dc/terms/isVersionOf> <http://example.org/id/123>;
      <abc> <http://data.europa.eu/949/wgs84_pos#Point>.
    `);
    const bucketizer = SubjectPageBucketizer.build(bucketizerOptions);
    const buckets = bucketizer.bucketize(member, 'http://example.org/id/123#456');

    const bucketQuads = buckets.filter(quad => quad.predicate.equals(bucketNode))!;

    expect(bucketQuads.length).toBe(1);
  });

  it('should normalize bucket id', () => {
    const member: RDF.Quad[] = new Parser().parse(`
      <http://example.org/id/123#456> <http://purl.org/dc/terms/isVersionOf> <http://example.org/id/123>;
      <abc> <http://data.europa.eu/949/wgs84_pos#Point>.
    `);
    const op = Object.assign({}, bucketizerOptions);
    op.propertyPath = "<abc>";
    const bucketizer = SubjectPageBucketizer.build(op);
    bucketizer.hash = "abc";
    const buckets = bucketizer.bucketize(member, 'http://example.org/id/123#456');

    const bucketQuads = buckets.filter(quad => quad.predicate.equals(bucketNode))!;
    expect(bucketQuads.length).toBe(1);
    expect(bucketQuads[0].object.value)
      .toEqual("wgs84_pos-point-abc");
  })

  it('should throw an error when property path option is not set', async () => {
    let err,
      ok;
    try {
      ok = await SubjectPageBucketizer.build({});
    } catch (error) {
      err = error;
    }

    expect(ok).toBeUndefined();
    expect(err).toEqual('expected propertyPath in options but found undefined');
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
