import type * as RDF from '@rdfjs/types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { DataFactory } from 'rdf-data-factory';
import { BasicBucketizer } from '../lib/BasicBucketizer';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('bucketizer-basic', () => {
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = factory.namedNode('https://w3id.org/ldes#bucket');

  it('should be a function', async () => {
    expect(BasicBucketizer).to.be.instanceOf(Function);
  });

  it('should be a constructor', async () => {
    const bucketizer = await BasicBucketizer.build({ pageSize: 1, propertyPath: '' });
    expect(bucketizer).to.be.instanceOf(BasicBucketizer);
  });

  it('should add members to the same page when it is not full', async () => {
    const bucketizer = await BasicBucketizer.build({ pageSize: 20, propertyPath: '' });
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
        expect(quad.object.value).to.equal('0');
      }
    });
  });

  it('should add a member to a new page when current page is full', async () => {
    const bucketizer = await BasicBucketizer.build({ pageSize: 1, propertyPath: '' });
    const member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    member.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.equal('0');
      }
    });

    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    newMember.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.equal('1');
      }
    });
  });

  it('should be able to exports its current state', async () => {
    const bucketizer = await BasicBucketizer.build({ pageSize: 1 });
    const member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('http://example.org/id/123'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    const state = bucketizer.exportState();

    const expectedState = {
      hypermediaControls: [],
      propertyPathQuads: [],
      pageNumber: 0,
      memberCounter: 1,
      bucketizerOptions: {
        pageSize: 1,
        root: 'root',
      },
      bucketlessPageNumber: 0,
      bucketlessPageMemberCounter: 0,
    };

    expect(state).to.eql(expectedState);
  });

  it('should import a previous state', async () => {
    const state = {
      hypermediaControls: [],
      propertyPathQuads: [],
      pageNumber: 5,
      memberCounter: 5,
    };

    const bucketizer = await BasicBucketizer.build({ pageSize: 10, propertyPath: '' }, state);

    expect(bucketizer.pageNumber).to.equal(state.pageNumber);
    expect(bucketizer.memberCounter).to.equal(state.memberCounter);
  });

  it('should set pageSize to 50 (default) if the option was not provided', async () => {
    const bucketizer = await BasicBucketizer.build({});
    expect(bucketizer.bucketizerOptions.pageSize).to.equal(50);
  });
});
