import type * as RDF from '@rdfjs/types';
import { expect } from 'chai';
import { DataFactory } from 'rdf-data-factory';
import { SubjectPageBucketizer } from '../lib/SubjectPageBucketizer';

describe('bucketizer-subject-page', () => {
  let member: RDF.Quad[];
  let factory: RDF.DataFactory;

  before(async () => {
    factory = new DataFactory();
  });

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
    expect(await SubjectPageBucketizer.build('(<http://purl.org/dc/terms/isVersionOf>)'))
      .to.be.instanceOf(SubjectPageBucketizer);
  });

  it('should throw an error when property path is not found', async () => {
    const bucketizer = await SubjectPageBucketizer.build('(<http://purl.org/dc/terms/isVersionOf>)');
    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('Test'),
      ),
    ];

    expect(() => bucketizer.bucketize(newMember, 'http://example.org/id/123#456')).to.throw(Error);
  });

  it('should add a bucket quad to the array of quads', async () => {
    const originalLength = member.length;
    const bucketizer = await SubjectPageBucketizer.build('(<http://purl.org/dc/terms/isVersionOf>)');
    bucketizer.bucketize(member, 'http://example.org/id/123#456');

    expect(member.length).to.equal(originalLength + 1);
  });
});
