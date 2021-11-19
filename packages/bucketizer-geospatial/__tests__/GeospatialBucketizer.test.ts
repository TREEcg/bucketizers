import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions } from '@treecg/types';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { DataFactory } from 'rdf-data-factory';
import { GeospatialBucketizer } from '../lib/GeospatialBucketizer';
import { SlippyMaps } from '../lib/utils/SlippyMaps';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('geospatial-bucketizer', () => {
  let member: RDF.Quad[];
  let bucketizerOptions: BucketizerOptions;
  const zoomLevel = 4;

  const factory: RDF.DataFactory = new DataFactory();
  const bucketNode = factory.namedNode('https://w3id.org/ldes#bucket');

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
    };
  });

  it('should be a function', async () => {
    expect(GeospatialBucketizer).to.be.instanceOf(Function);
  });

  it('should be a constructor', async () => {
    const bucketizer = await GeospatialBucketizer.build(bucketizerOptions, zoomLevel);

    expect(bucketizer).to.be.instanceOf(GeospatialBucketizer);
  });

  it('should throw an error when property path is not found', async () => {
    const bucketizer = await GeospatialBucketizer.build(bucketizerOptions, zoomLevel);
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

    expect(() => bucketizer.bucketize(memberWithoutPropertyPath, 'http://example.org/id/1'))
      .to.throw(Error);
  });

  it('should add one or more bucket triples to a member', async () => {
    const bucketizer = await GeospatialBucketizer.build(bucketizerOptions, zoomLevel);

    // Change literal, so flattenArray function must be executed as well
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

    bucketizer.bucketize(member, 'http://example.org/id/1');
    const predicates = member.filter(quad => quad.predicate.equals(bucketNode));

    expect(predicates.length).to.be.greaterThan(0);
  });

  it('should throw an error when property path option is not set', async () => {
    await expect(GeospatialBucketizer.build({}, zoomLevel)).to.be.rejectedWith(Error);
  });

  it('should be able to export its current state', async () => {
    const bucketizer = await GeospatialBucketizer.build(bucketizerOptions, zoomLevel);
    const currentState = bucketizer.exportState();

    expect(currentState).to.haveOwnProperty('hypermediaControls');
    expect(currentState).to.haveOwnProperty('zoomLevel');
    expect(currentState).to.haveOwnProperty('tileColumnMap');
    expect(currentState).to.haveOwnProperty('propertyPathQuads');
  });

  // TODO: add extra expect statements for this test
  it('should be able to import a previous state', async () => {
    const state: any = {
      hypermediaControls: [],
      propertyPathQuads: [],
      zoomLevel: 10,
      tileColumnMap: [[0, [1]]],
    };

    const bucketizer = await GeospatialBucketizer.build(bucketizerOptions, zoomLevel, state);
    const currentState = bucketizer.exportState();

    expect(currentState.zoomLevel).to.equal(state.zoomLevel);
    expect(currentState.tileColumnMap).to.eql(state.tileColumnMap);
  });

  it('should throw an error when geo literal type is not supported', async () => {
    // At the moment, only WKT is supported
    const bucketizer = await GeospatialBucketizer.build(bucketizerOptions, zoomLevel);

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

    expect(() => bucketizer.bucketize(memberWithoutSupportedGeoType, 'http://example.org/id/4')).to.throw(Error);
  });

  it('should update hypermedia controls when a new tile is added', async () => {
    const otherMember = [
      factory.quad(
        factory.namedNode('http://example.org/id/5'),
        factory.namedNode('http://www.w3.org/ns/dcat#bbox'),
        factory.literal(
          'POINT(-148.79727588411623 77.06742539146222)',
          factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'),
        ),
      ),
    ];

    const bucketizer = await GeospatialBucketizer.build(bucketizerOptions, zoomLevel);
    const slippyMaps = new SlippyMaps(zoomLevel);

    // Member has tile X = 1 and Y = 1
    bucketizer.bucketize(member, 'http://example.org/id/1');
    let columnRelationParameters = bucketizer.getHypermediaControls('root')![0];
    const boundingBox1 = slippyMaps.getTileBoundingBoxWktString(1, 1, zoomLevel);
    expect(columnRelationParameters.value![0].value).to.equal(boundingBox1);

    // OtherMember has tile X = 1 and Y = 2
    bucketizer.bucketize(otherMember, 'http://example.org/id/5');
    columnRelationParameters = bucketizer.getHypermediaControls('root')![0];
    const boundingBox2 = slippyMaps.getTileBoundingBoxWktString(1, 2, zoomLevel);

    const updatedBoundingBox = slippyMaps.mergePolygons(boundingBox1, boundingBox2);
    expect(columnRelationParameters.value![0].value).to.equal(updatedBoundingBox);
  });

  it('should flatten the arrays', async () => {
    const literal = factory.literal(
      // eslint-disable-next-line max-len
      'MULTIPOLYGON (((40 40, 20 45, 45 30, 40 40)), ((20 35, 45 20, 30 5, 10 10, 10 30, 20 35), (30 20, 20 25, 20 15, 30 20)))',
      factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'),
    );

    const slippyMaps = new SlippyMaps(zoomLevel);

    slippyMaps.calculateTiles(literal);
  });
});
