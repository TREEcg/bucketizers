import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions } from '@treecg/types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { DataFactory } from 'rdf-data-factory';
import { SubjectPageBucketizer } from '../lib/SubjectPageBucketizer';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('bucketizer-subject-page', () => {
  let member: RDF.Quad[];
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = factory.namedNode('https://w3id.org/ldes#bucket');

  const bucketizerOptions: BucketizerOptions = {
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
    expect(SubjectPageBucketizer).to.be.instanceOf(Function);
  });

  it('should be a constructor', async () => {
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    expect(bucketizer)
      .to.be.instanceOf(SubjectPageBucketizer);
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
    expect(bucketTriple.object.value).to.equal('bucketless-0');
  });

  it('should add one or more bucket triples to a member', async () => {
    const originalLength = member.length;
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    bucketizer.bucketize(member, 'http://example.org/id/123#456');

    const bucketQuads = member.filter(quad => quad.predicate.equals(bucketNode))!;

    expect(bucketQuads.length).to.be.greaterThan(0);
  });

  it('should throw an error when property path option is not set', async () => {
    await expect(SubjectPageBucketizer.build({})).to.be.rejectedWith(Error);
  });

  it('should be able to export its current state', async () => {
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    const currentState = bucketizer.exportState();

    expect(currentState).to.haveOwnProperty('hypermediaControls');
    expect(currentState).to.haveOwnProperty('propertyPathQuads');
    expect(currentState).to.haveOwnProperty('bucketizerOptions');
    expect(currentState).to.haveOwnProperty('bucketlessPageNumber');
    expect(currentState).to.haveOwnProperty('bucketlessPageMemberCounter');
  });

  it('should import a previous state', async () => {
    const propertyPathQuads = [
      factory.quad(
        factory.blankNode('_:b2_b0'),
        factory.namedNode('https://w3id.org/tree#path'),
        factory.blankNode('_:n3-2'),
      ),
      factory.quad(
        factory.blankNode('_:n3-2'),
        factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
      ),
      factory.quad(
        factory.blankNode('_:n3-2'),
        factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'),
        factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'),
      ),
    ];

    const state = {
      hypermediaControls: [],
      propertyPathQuads,
    };

    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions, state);

    expect(bucketizer.getPropertyPathQuads()).to.eql(state.propertyPathQuads);
    expect(bucketizer.getBucketHypermediaControlsMap()).to.eql(new Map(state.hypermediaControls));
  });
});
