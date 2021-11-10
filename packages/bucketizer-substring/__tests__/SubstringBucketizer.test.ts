import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions, RelationParameters } from '@treecg/types';
import { RelationType } from '@treecg/types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { DataFactory } from 'rdf-data-factory';
import { SubstringBucketizer } from '../lib/SubstringBucketizer';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('ldes-substring-bucketizer', () => {
  let member: RDF.Quad[];
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = factory.namedNode('https://w3id.org/ldes#bucket');
  let bucketizerOptions: BucketizerOptions;

  beforeEach(async () => {
    member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ];

    bucketizerOptions = {
      propertyPath: '(<http://www.w3.org/2000/01/rdf-schema#label>)',
      pageSize: 1,
    };
  });

  it('should be a function', async () => {
    expect(SubstringBucketizer).to.be.instanceOf(Function);
  });

  it('should be a constructor', async () => {
    bucketizerOptions.pageSize = 20;
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);

    expect(bucketizer)
      .to.be.instanceOf(SubstringBucketizer);
  });

  it('should add a bucket quad to the array of quads', async () => {
    const originalLength = member.length;
    bucketizerOptions.pageSize = 20;
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);

    bucketizer.bucketize(member, 'http://example.org/id/123#456');

    expect(member.length).to.equal(originalLength + 1);
  });

  it('should throw an error when property path is not found', async () => {
    bucketizerOptions.pageSize = 20;
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('Test'),
      ),
    ];

    expect(() => bucketizer.bucketize(newMember, 'http://example.org/id/123#456')).to.throw(Error);
  });

  it('should add LDES members to the current page, when page is not full yet', async () => {
    bucketizerOptions.pageSize = 20;
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    [...member, ...newMember].forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.equal('root');
      }
    });
  });

  it('should add an LDES member to another page when current page is full', async () => {
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    let newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#246'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('Jane Doe'),
      ),
    ];

    bucketizer.bucketize(newMember, 'http://example.org/id/123#246');

    const hypermediaControls = bucketizer.getHypermediaControls('root');
    const relationParameters: RelationParameters = {
      nodeId: 'j',
      type: RelationType.Substring,
      value: [factory.literal('j', factory.namedNode('http://www.w3.org/2001/XMLSchema#string'))],
    };
    expect(hypermediaControls).to.an('array').that.deep.includes.members([relationParameters]);

    const buckets = ['root', 'j', 'ja'];
    [...member, ...newMember].forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.be.oneOf(buckets);
      }
    });
  });

  it('it should cope with strings that contain spaces', async () => {
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    let newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#1'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('J D'),
      ),
    ];

    bucketizer.bucketize(newMember, 'http://example.org/id/123#1');

    newMember.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.equal('j+d');
      }
    });
  });

  it('should add a member to the current page when whole string was iterated, even when page is full', async () => {
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    let newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    newMember.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.equal('j');
      }
    });

    newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#1'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('J'),
      ),
    ];

    bucketizer.bucketize(newMember, 'http://example.org/id/123#1');

    newMember.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.equal('j');
      }
    });
  });

  it('should throw an error when "propertyPath" and/or "pageSize" option is not provided', async () => {
    await expect(SubstringBucketizer.build({})).to.be.rejectedWith(Error);
  });

  it('should be able to import a previous state', async () => {
    const state = {
      hypermediaControls: [],
      propertyPathQuads: [],
      bucketCounter: [],
    };

    const bucketizer = await SubstringBucketizer.build(bucketizerOptions, state);

    expect(bucketizer.getBucketHypermediaControlsMap()).to.eql(new Map(state.hypermediaControls));
    expect(bucketizer.getPropertyPathQuads()).to.eql(state.propertyPathQuads);
    expect(bucketizer.bucketCounterMap).to.eql(new Map(state.bucketCounter));
  });

  it('should be able to export its current state', async () => {
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    const currentState = bucketizer.exportState();

    expect(currentState).to.haveOwnProperty('hypermediaControls');
    expect(currentState).to.haveOwnProperty('bucketCounter');
    expect(currentState).to.haveOwnProperty('propertyPathQuads');
  });
});
