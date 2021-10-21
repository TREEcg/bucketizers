import type * as RDF from '@rdfjs/types';
import { expect } from 'chai';
import { DataFactory } from 'rdf-data-factory';
import { SubstringBucketizer } from '../lib/SubstringBucketizer';

describe('ldes-substring-bucketizer', () => {
  let member: RDF.Quad[];
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = factory.namedNode('https://w3id.org/ldes#bucket');

  beforeEach(async () => {
    member = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ];
  });

  it('should be a function', async () => {
    expect(SubstringBucketizer).to.be.instanceOf(Function);
  });

  it('should be a constructor', async () => {
    expect(await SubstringBucketizer.build('(<http://www.w3.org/2000/01/rdf-schema#label>)', 20))
      .to.be.instanceOf(SubstringBucketizer);
  });

  it('should add a bucket quad to the array of quads', async () => {
    const originalLength = member.length;
    const bucketizer = await SubstringBucketizer.build('(<http://www.w3.org/2000/01/rdf-schema#label>)', 20);

    bucketizer.bucketize(member, 'http://example.org/id/123#456');

    expect(member.length).to.equal(originalLength + 1);
  });

  it('should throw an error when property path is not found', async () => {
    const bucketizer = await SubstringBucketizer.build('(<http://www.w3.org/2000/01/rdf-schema#label>)', 20);
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
    const bucketizer = await SubstringBucketizer.build('(<http://www.w3.org/2000/01/rdf-schema#label>)', 20);
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
    const bucketizer = await SubstringBucketizer.build('(<http://www.w3.org/2000/01/rdf-schema#label>)', 1);
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
    expect(hypermediaControls).to.an('array').that.includes('j');

    const buckets = ['root', 'j', 'ja'];
    [...member, ...newMember].forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).to.be.oneOf(buckets);
      }
    });
  });

  it('it should cope with strings that contain spaces', async () => {
    const bucketizer = await SubstringBucketizer.build('(<http://www.w3.org/2000/01/rdf-schema#label>)', 1);
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
    const bucketizer = await SubstringBucketizer.build('(<http://www.w3.org/2000/01/rdf-schema#label>)', 1);
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
});
