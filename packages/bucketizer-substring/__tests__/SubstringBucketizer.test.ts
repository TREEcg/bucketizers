import { describe, expect, test, it } from "@jest/globals";
import type * as RDF from '@rdfjs/types';
import type { BucketizerCoreExtOptions, RelationParameters } from '@treecg/types';
import { SDS, RelationType } from '@treecg/types';
import { DataFactory, NamedNode } from 'rdf-data-factory';
import { SubstringBucketizer } from '../lib/SubstringBucketizer';


describe('ldes-substring-bucketizer', () => {
  let member: RDF.Quad[];
  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = SDS.terms.custom('bucket');
  let bucketizerOptions: BucketizerCoreExtOptions;

  const getMember = (id?: string) => {
    const idNode =
      factory.namedNode(id || 'http://example.org/id/123#456');
    return <[RDF.Quad[], NamedNode]>[[
      factory.quad(
        idNode,
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('John Doe'),
      ),
    ], idNode];
  }

  beforeEach(async () => {
    member = getMember()[0];

    bucketizerOptions = <BucketizerCoreExtOptions><any>{
      root: '',
      bucketProperty: '',
      bucketBase: '',
      propertyPath: '(<http://www.w3.org/2000/01/rdf-schema#label>)',
      pageSize: 1,
    };
  });

  test('should be a function', async () => {
    expect(SubstringBucketizer).toBeInstanceOf(Function);
  });

  it('should be a constructor', async () => {
    bucketizerOptions.pageSize = 20;
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);

    expect(bucketizer).toBeInstanceOf(SubstringBucketizer);
  });

  it('should set page size to the default value when not configured', async () => {
    const options = {
      propertyPath: '(<http://www.w3.org/2000/01/rdf-schema#label>)',
    };

    const bucketizer = await SubstringBucketizer.build(options);
    expect(bucketizer.options.pageSize).toEqual(50);
  });

  it('should apply the fallback function when property path is not found', async () => {
    bucketizerOptions.pageSize = 20;
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#456'),
        factory.namedNode('http://purl.org/dc/terms/isVersionOf'),
        factory.namedNode('Test'),
      ),
    ];

    const buckets = bucketizer.bucketize(newMember, 'http://example.org/id/123#456');
    const bucketTriple: RDF.Quad = buckets.find(quad => quad.predicate.equals(bucketNode))!;
    expect(bucketTriple.object.value).toEqual('bucketless-0');
  });

  it('should add one or more bucket triples to a member', async () => {
    const originalLength = member.length;
    bucketizerOptions.pageSize = 20;
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);

    const [newMember, id] = getMember();
    const buckets = bucketizer.bucketize(newMember, id.value);

    const bucketQuads = buckets.filter(quad => quad.predicate.equals(bucketNode))!;

    expect(bucketQuads.length).toBeGreaterThan(0);
  });

  it('should respect pageSize', async () => {
    bucketizerOptions.pageSize = 2;
    const bucketizer = SubstringBucketizer.build(bucketizerOptions);

    const buckets: RDF.Quad[] = [];

    // 5 elements, 3 buckets
    for (let i = 0; i < 5; i++) {
      const [member1, id1] = getMember();
      buckets.push(...bucketizer.bucketize(member1, id1.value));
    }

    const counts: { [label: string]: number } = {};
    for (let bucket of buckets.filter(x => x.predicate.equals(SDS.terms.custom("bucket")))) {
      if (!(bucket.object.value in counts)) {
        counts[bucket.object.value] = 0;

      }
      counts[bucket.object.value]++;
    }

    const values = Object.values(counts).sort();

    expect(values).toEqual([1, 2, 2]);
  })

  it('should throw an error when property path option is not set', async () => {
    let error,
      ok;
    try {
      ok = await SubstringBucketizer.build({});
    } catch (error_) {
      error = error_;
    }
    expect(ok).toBeUndefined();
    expect(error).not.toBeUndefined();
  });

  it('should be able to export its current state', async () => {
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    const currentState = bucketizer.exportState();

    expect(currentState).toHaveProperty('hypermediaControls');
    expect(currentState).toHaveProperty('propertyPathPredicates');
    expect(currentState).toHaveProperty('bucketizerOptions');
    expect(currentState).toHaveProperty('bucketlessPageNumber');
    expect(currentState).toHaveProperty('bucketlessPageMemberCounter');
    expect(currentState).toHaveProperty('bucketCounter');
  });

  it('should be able to import a previous state', async () => {
    const state = {
      hypermediaControls: [],
      propertyPathPredicates: [],
      bucketCounter: [],
    };

    const bucketizer = await SubstringBucketizer.build(bucketizerOptions, state);

    expect(bucketizer.getBucketHypermediaControlsMap()).toEqual(new Map(state.hypermediaControls));
    expect(bucketizer.getPropertyPathPredicates()).toEqual(state.propertyPathPredicates);
    expect(bucketizer.bucketCounterMap).toEqual(new Map(state.bucketCounter));
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
        expect(quad.object.value).toEqual('root');
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

    expect(Array.isArray(hypermediaControls));
    expect(hypermediaControls).toContainEqual(relationParameters);

    const buckets = ['root', 'j', 'ja'];
    [...member, ...newMember].forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(buckets).toContain(quad.object.value);
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
        expect(quad.object.value).toEqual('j+d');
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
        expect(quad.object.value).toEqual('j');
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
        expect(quad.object.value).toEqual('j');
      }
    });
  });

  it('should normalize properly', async () => {
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('\u0303\u0237'),
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    newMember.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).toEqual('\u0237');
      }
    });
  });

  it('should normailze properly 2', async () => {
    const bucketizer = await SubstringBucketizer.build(bucketizerOptions);
    const newMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/123#789'),
        factory.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        factory.namedNode('\u00F1'), // See: ñ == '\u00F1' == '\u006E\u0303' and '\u0303' == ~
      ),
    ];

    bucketizer.bucketize(member, 'http://example.org/id/123#456');
    bucketizer.bucketize(newMember, 'http://example.org/id/123#789');

    newMember.forEach(quad => {
      if (quad.predicate.equals(bucketNode)) {
        expect(quad.object.value).toEqual('\u006E');
      }
    });
  });
});
