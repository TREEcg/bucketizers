import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions, RelationParameters } from '@treecg/types';
import { Bucketizer, RelationType } from '@treecg/types';
import { SlippyMaps } from './utils/SlippyMaps';

const ROOT = 'root';

export class GeospatialBucketizer extends Bucketizer {
  private readonly propertyPath: string;
  private zoomLevel: number;
  private readonly slippyMaps: SlippyMaps;

  // Stores all y's for a certain x
  private tileColumnMap: Map<number, number[]>;

  private constructor(propertyPath: string, zoomLevel: number) {
    super();
    this.propertyPath = propertyPath;
    this.zoomLevel = zoomLevel;
    this.slippyMaps = new SlippyMaps(zoomLevel);
    this.tileColumnMap = new Map();

    this.addHypermediaControls(ROOT, []);
  }

  public static async build(
    bucketizerOptions: BucketizerOptions,
    zoomLevel: number,
    state?: any,
  ): Promise<GeospatialBucketizer> {
    if (!bucketizerOptions.propertyPath) {
      throw new Error(`[GeospatialBucketizer]: Please provide a valid property path.`);
    }

    const bucketizer = new GeospatialBucketizer(bucketizerOptions.propertyPath, zoomLevel);

    if (state) {
      bucketizer.importState(state);
    } else {
      await bucketizer.setPropertyPathQuads(bucketizerOptions.propertyPath);
    }

    return bucketizer;
  }

  public bucketize = (quads: RDF.Quad[], memberId: string): void => {
    const propertyPathObjects: RDF.Term[] = this.extractPropertyPathObject(quads, memberId);

    if (propertyPathObjects.length <= 0) {
      throw new Error(`[GeospatialBucketizer]: No matches found for property path "${this.propertyPath}"`);
    }

    const buckets = this.createBuckets(propertyPathObjects);
    const bucketTriples = buckets.map(bucket => this.createBucketTriple(bucket, memberId));

    quads.push(...bucketTriples);
  };

  protected createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    const buckets: string[] = [];

    propertyPathObjects.forEach(term => {
      const tilesMap = this.slippyMaps.calculateTiles(term);

      tilesMap.forEach((values, x) => {
        if (!this.tileColumnMap.get(x)) {
          this.tileColumnMap.set(x, []);
        }

        values.forEach(y => {
          const leafNodePath = `${this.zoomLevel}/${x}/${y}`;
          const columnPath = `${this.zoomLevel}/${x}`;

          buckets.push(leafNodePath);

          // Update hypermedia controls
          const leafNodes = this.tileColumnMap.get(x)!;

          if (!leafNodes.includes(y)) {
            this.tileColumnMap.set(x, [...leafNodes, y]);
            const wktString = this.slippyMaps.getTileBoundingBoxWktString(x, y, this.zoomLevel);

            // Update hypermedia controls for column (x)
            let columnHypermediaControls = this.getHypermediaControls(columnPath);
            if (!columnHypermediaControls) {
              columnHypermediaControls = [];
              this.addHypermediaControls(columnPath, columnHypermediaControls);
            }

            if (!columnHypermediaControls.some(parameterObject => parameterObject.nodeId === leafNodePath)) {
              this.addHypermediaControls(
                columnPath,
                [...columnHypermediaControls, this.createRelationParameters(leafNodePath, wktString)],
              );
            }

            // Update hypermedia controls for root
            const rootHypermediaControls = this.getHypermediaControls(ROOT)!;
            const columnRelationParameters =
              rootHypermediaControls.find(parameterObject => parameterObject.nodeId === columnPath);

            if (columnRelationParameters) {
              const polygon = columnRelationParameters.value![0];
              const updatedPolygon = this.slippyMaps.mergePolygons(polygon.value, wktString);

              columnRelationParameters.value = [
                this.factory.literal(
                  updatedPolygon,
                  this.factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'),
                ),
              ];
            } else {
              this.addHypermediaControls(
                ROOT,
                [...rootHypermediaControls, this.createRelationParameters(columnPath, wktString)],
              );
            }
          }
        });
      });
    });

    return buckets;
  };

  private readonly createRelationParameters = (
    targetNode: string,
    value: string,
  ): RelationParameters => ({
    nodeId: targetNode,
    type: RelationType.GeospatiallyContains,
    value: [this.factory.literal(value, this.factory.namedNode('http://www.opengis.net/ont/geosparql#wktLiteral'))],
  });

  public exportState(): any {
    const state = super.exportState();
    state.zoomLevel = this.zoomLevel;
    state.tileColumnMap = Array.from(this.tileColumnMap.entries());

    return state;
  }

  public importState(state: any): void {
    super.importState(state);
    this.zoomLevel = state.zoomLevel;
    this.tileColumnMap = new Map(state.tileColumnMap);
  }
}
