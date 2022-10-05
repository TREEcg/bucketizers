import type * as RDF from '@rdfjs/types';
import { SDS } from '@treecg/types';
import { DataFactory } from 'rdf-data-factory';
import type { BasicInputType } from '../lib/BasicBucketizer';
import { BasicBucketizer } from '../lib/BasicBucketizer';

describe('bucketizer-basic', () => {
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = SDS.terms.custom('bucket');

  it('should be a function', async () => {
    expect(BasicBucketizer).toBeInstanceOf(Function);
  });

  it('should be a constructor', async () => {
    const bucketizer = BasicBucketizer.build({ pageSize: 1 });
    expect(bucketizer).toBeInstanceOf(BasicBucketizer);
  });

  it('should set page size to the default value when not configured', async () => {
    const bucketizer = BasicBucketizer.build({});
    expect(bucketizer.options.pageSize).toEqual(50);
  });

  it('should add members to the same page when it is not full', async () => {
    const bucketizer = BasicBucketizer.build({ pageSize: 20 });
    const member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];

    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    [...member, ...newMember].forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).toEqual('0');
      }
    });
  });

  it('should add a member to a new page when current page is full', async () => {
    const bucketizer = BasicBucketizer.build({ pageSize: 1, bucketBase: '' });
    const member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];

    const buckets1 = bucketizer.bucketize(member, 'http://example.org/id/123#456');
    buckets1.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).toEqual('0');
      }
    });

    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];
    const buckets2 = bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    buckets2.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).toEqual('1');
      }
    });
  });

  it('should be able to export its current state', async () => {
    const bucketizer = BasicBucketizer.build({ pageSize: 1 });
    const currentState = bucketizer.exportState();

    expect(currentState).toHaveProperty('hypermediaControls');
    expect(currentState).toHaveProperty('pageNumber');
    expect(currentState).toHaveProperty('memberCounter');
    expect(currentState).toHaveProperty('bucketizerOptions');
  });

  it('should import a previous state', async () => {
    const state = {
      hypermediaControls: [],
      pageNumber: 5,
      memberCounter: 5,
    };

    const bucketizer = BasicBucketizer.build({ pageSize: 10 }, state);

    expect(bucketizer.pageNumber).toEqual(state.pageNumber);
    expect(bucketizer.memberCounter).toEqual(state.memberCounter);
    expect(bucketizer.getBucketHypermediaControlsMap()).toEqual(new Map(state.hypermediaControls));
  });

  it('uses bucketbase correctly', async () => {
    const options: BasicInputType = {
      bucketBase: '1234-',
    };

    const bucketizer = BasicBucketizer.build(options);

    const member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];

    const buckets1 = bucketizer.bucketize(member, 'http://example.org/id/123#456');
    console.log(buckets1);
    buckets1.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).toEqual('1234-0');
      }
    });
  });

  it('links buckets correctly', async () => {
    const options: BasicInputType = {
      bucketBase: '1234-',
      pageSize: 1,
    };

    const bucketizer = BasicBucketizer.build(options);

    const member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];

    const buckets1 = bucketizer.bucketize(member, 'http://example.org/id/123#456');
    const bucket1Id = buckets1.find(q => q.predicate.equals(bucketNode))!.object;

    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];
    const buckets2 = bucketizer.bucketize(newMember, 'http://example.org/id/123#789');
    const bucket2Id = buckets2.find(q => q.predicate.equals(bucketNode))!.object;

    const relId = buckets2.find(q => q.predicate.equals(SDS.terms.custom('relation')))!;

    expect(relId.subject.equals(bucket1Id)).toBeTruthy();

    const targetId = buckets2.find(q => q.subject.equals(relId.object) && q.predicate.equals(SDS.terms.custom('relationBucket')))!.object;
    expect(targetId.equals(bucket2Id)).toBeTruthy();
  });
});

