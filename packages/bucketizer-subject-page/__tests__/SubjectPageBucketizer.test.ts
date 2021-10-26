import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions } from '@treecg/types';
import { expect } from 'chai';
import { DataFactory } from 'rdf-data-factory';
import { SubjectPageBucketizer } from '../lib/SubjectPageBucketizer';

describe('bucketizer-subject-page', () => {
  let member: RDF.Quad[];
  const factory: RDF.DataFactory = new DataFactory();
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

  it('should throw an error when property path is not found', async () => {
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
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
    const bucketizer = await SubjectPageBucketizer.build(bucketizerOptions);
    bucketizer.bucketize(member, 'http://example.org/id/123#456');

    expect(member.length).to.equal(originalLength + 1);
  });
});
