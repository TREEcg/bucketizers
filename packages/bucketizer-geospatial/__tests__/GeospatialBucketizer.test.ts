import { describe, expect, it } from "@jest/globals";
import type * as RDF from '@rdfjs/types';
import { SDS } from '@treecg/types';
import { DataFactory } from 'rdf-data-factory';
import type { GeospatialInputType } from '../lib/GeospatialBucketizer';
import { GeospatialBucketizer } from '../lib/GeospatialBucketizer';
import { SlippyMaps } from '../lib/utils/SlippyMaps';

describe('geospatial-bucketizer', () => {
  let member: RDF.Quad[];
  let bucketizerOptions: GeospatialInputType;
  const zoomLevel = 4;

  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = SDS.terms.custom('bucket');

  let bucketizer: GeospatialBucketizer;

  beforeEach(async () => {
    member = [
      factory.quad(
        factory.namedNode('http://example.org/id/1'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal(
          'POINT(-149.41251025911623 80.58142160919965)',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'),
        ),
      ),
    ];

    bucketizerOptions = {
      propertyPath: '<http://www.w3.org/ns/dcat#bbox>',
      pageSize: 50,
      zoom: zoomLevel,
    };

    bucketizer = await GeospatialBucketizer.build(bucketizerOptions);
  });

  it('should be a function', async () => {
    expect(GeospatialBucketizer).toBeInstanceOf(Function);
  });

  it('should be a constructor', async () => {
    expect(bucketizer).toBeInstanceOf(GeospatialBucketizer);
  });

  it('should set page size to the default value when not configured', async () => {
    bucketizerOptions = {
      propertyPath: '<http://www.w3.org/ns/dcat#bbox>',
      zoom: zoomLevel,
    };

    const geospatialBucketizer = await GeospatialBucketizer.build(bucketizerOptions);
    expect(geospatialBucketizer.options.pageSize).toEqual(50);
  });

  it('should apply the fallback function when property path is not found', async () => {
    const memberWithoutPropertyPath = [
      factory.quad(
        factory.namedNode('http://example.org/id/2'),
        factory.namedNode('http://example.org/bbox'),
        factory.literal(
          'Polygon((-63.37716 45.97597,-71.05923 45.97597,-71.05923 41.65926,-63.37716 41.65926,-63.37716 45.97597))',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'),
        ),
      ),
    ];

    const buckets = bucketizer.bucketize(memberWithoutPropertyPath, 'http://example.org/id/2');

    const bucketTriple: RDF.Quad = buckets.find(quad => quad.predicate.equals(bucketNode))!;
    expect(bucketTriple.object.value).toEqual('bucketless-0');
  });

  it('should add one or more bucket triples to a member', async () => {
    member = [
      factory.quad(
        factory.namedNode('http://example.org/id/1'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal(
          // eslint-disable-next-line max-len
          'MULTIPOLYGON (((40 40, 20 45, 45 30, 40 40)), ((20 35, 45 20, 30 5, 10 10, 10 30, 20 35), (30 20, 20 25, 20 15, 30 20)))',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'),
        ),
      ),
    ];

    const buckets = bucketizer.bucketize(member, 'http://example.org/id/1');
    const predicates = buckets.filter(quad => quad.predicate.equals(bucketNode));

    expect(predicates.length).toBeGreaterThan(0);
  });

  it('should throw an error when property path option is not set', async () => {
    let err,
      ok;
    try {
      ok = await GeospatialBucketizer.build({ zoom: zoomLevel });
    } catch (error) {
      err = error;
    }
    expect(ok).toBeUndefined();
    expect(err).toEqual('expected propertyPath in options but found undefined');
  });

  it('should be able to export its current state', async () => {
    const currentState = bucketizer.exportState();

    expect(currentState).toHaveProperty('hypermediaControls');
    expect(currentState).toHaveProperty('zoomLevel');
    expect(currentState).toHaveProperty('tileMetadataMap');
    expect(currentState).toHaveProperty('propertyPathPredicates');
    expect(currentState).toHaveProperty('bucketizerOptions');
    expect(currentState).toHaveProperty('bucketlessPageNumber');
    expect(currentState).toHaveProperty('bucketlessPageMemberCounter');
  });

  it('should be able to import a previous state', async () => {
    const state: any = {
      hypermediaControls: [],
      propertyPathPredicates: [],
      zoomLevel: 10,
      tileMetadataMap: [[0, [1]]],
      bucketlessPageNumber: 0,
      bucketlessPageMemberCounter: 0,
    };

    const bucketizerWithState = await GeospatialBucketizer.build(bucketizerOptions, state);
    const currentState = bucketizerWithState.exportState();

    expect(currentState.zoomLevel).toEqual(state.zoomLevel);
    expect(currentState.tileColumnMap).toEqual(state.tileColumnMap);
    expect(currentState.bucketlessPageNumber).toEqual(state.bucketlessPageNumber);
    expect(currentState.bucketlessPageMemberCounter).toEqual(state.bucketlessPageMemberCounter);
    expect(bucketizerWithState.getPropertyPathPredicates()).toEqual(state.propertyPathPredicates);
    expect(bucketizerWithState.getBucketHypermediaControlsMap()).toEqual(new Map(state.hypermediaControls));
  });

  it('should apply fallback function when geo literal type is not supported', async () => {
    // At the moment, only WKT is supported
    const memberWithoutSupportedGeoType = [
      factory.quad(
        factory.namedNode('http://example.org/id/4'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal(
          // eslint-disable-next-line max-len
          '<gml:Point gml:id="p21" srsName="http://www.opengis.net/def/crs/EPSG/0/4326">< gml: pos srsDimension = "2" > 45.67 88.56 < /gml:pos></gml:Point>',
          factory.namedNode('http://www.opengis.net/ont/geosparql#gmlLiteral'),
        ),
      ),
    ];

    const buckets = bucketizer.bucketize(memberWithoutSupportedGeoType, 'http://example.org/id/2');

    const bucketTriple: RDF.Quad = buckets.find(quad => quad.predicate.equals(bucketNode))!;
    expect(bucketTriple.object.value).toEqual('bucketless-0');
  });

  it('should be able to handle WKT literals with their coordinate system present in the string', async () => {
    const literal = factory.literal(
      // eslint-disable-next-line max-len
      '<http://www.opengis.net/def/crs/OGC/1.3/CRS84> Polygon(180 -42.5802,179.87257 -42.5802,179.87257 -42.86535,180 -42.86535,180 -42.5802)',
      factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'),
    );

    const slippyMaps = new SlippyMaps(4);
    expect(() => slippyMaps.calculateTiles(literal)).not.toThrow(Error);
  });

  it('should add members to the same tile file when page size is not reached', async () => {
    const member1 = [
      factory.quad(
        factory.namedNode('http://example.org/id/5'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal('POINT(3.1516329600511916 51.08919224082551)',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral')),
      ),
    ];

    const member2 = [
      factory.quad(
        factory.namedNode('http://example.org/id/6'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal('POINT(4.777609522551192 50.784567520377436)',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral')),
      ),
    ];

    const buckets1 = bucketizer.bucketize(member1, 'http://example.org/id/5');
    const buckets2 = bucketizer.bucketize(member2, 'http://example.org/id/6');

    const member1Bucket = buckets1.find(quad => quad.predicate.equals(bucketNode))!;
    const member2Bucket = buckets2.find(quad => quad.predicate.equals(bucketNode))!;

    expect(member1Bucket.object.value).toEqual(member2Bucket.object.value);
  });

  it('should update tile metadata when page limit is reached', async () => {
    bucketizerOptions = {
      propertyPath: '<http://www.w3.org/ns/dcat#bbox>',
      pageSize: 1,
      zoom: zoomLevel,
    };

    // Tile X: 8, Y: 5
    const member1 = [
      factory.quad(
        factory.namedNode('http://example.org/id/5'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal('POINT(3.1516329600511916 51.08919224082551)',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral')),
      ),
    ];

    // Tile X: 8, Y: 5 (same tile, but should be in different bucket)
    const member2 = [
      factory.quad(
        factory.namedNode('http://example.org/id/6'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal('POINT(4.777609522551192 50.784567520377436)',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral')),
      ),
    ];

    const geospatialBucketizer = await GeospatialBucketizer.build(bucketizerOptions);
    const buckets1 = geospatialBucketizer.bucketize(member1, 'http://example.org/id/5');
    const buckets2 = geospatialBucketizer.bucketize(member2, 'http://example.org/id/6');

    const member1Bucket = buckets1.find(quad => quad.predicate.equals(bucketNode))!;
    const member2Bucket = buckets2.find(quad => quad.predicate.equals(bucketNode))!;

    expect(member1Bucket.object.value).toEqual('4/8/5-0');
    expect(member2Bucket.object.value).toEqual('4/8/5-1');
  });
});
