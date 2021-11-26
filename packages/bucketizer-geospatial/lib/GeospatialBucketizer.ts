import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions, RelationParameters } from '@treecg/types';
import { Bucketizer, RelationType } from '@treecg/types';
import { SlippyMaps } from './utils/SlippyMaps';

export interface ITileMetadata {
  pageNumber: number;
  memberCounter: number;
}

export class GeospatialBucketizer extends Bucketizer {
  private readonly propertyPath: string;
  private zoomLevel: number;
  private readonly slippyMaps: SlippyMaps;

  // Store current page number and numbers of members for each tile (x/y)
  private tileMetadataMap: Map<string, ITileMetadata>;

  private constructor(bucketizerOptions: BucketizerOptions, zoomLevel: number) {
    super(bucketizerOptions);

    this.zoomLevel = zoomLevel;
    this.slippyMaps = new SlippyMaps(zoomLevel);
    this.tileMetadataMap = new Map();

    this.addHypermediaControls(this.bucketizerOptions.root!, []);
  }

  public static async build(
    bucketizerOptions: BucketizerOptions,
    zoomLevel: number,
    state?: any,
  ): Promise<GeospatialBucketizer> {
    if (!bucketizerOptions.propertyPath) {
      throw new Error(`[GeospatialBucketizer]: Please provide a valid property path.`);
    }

    const bucketizer = new GeospatialBucketizer(bucketizerOptions, zoomLevel);

    if (!bucketizerOptions.pageSize) {
      bucketizer.logger.warn(`Page size was not configured and will be set to default value = 50`);
      bucketizer.bucketizerOptions.pageSize = 50;
    }

    if (state) {
      bucketizer.importState(state);
    } else {
      await bucketizer.setPropertyPathQuads(bucketizerOptions.propertyPath);
    }

    return bucketizer;
  }

  protected createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    const buckets: string[] = [];

    propertyPathObjects.forEach(term => {
      const tilesMap = this.slippyMaps.calculateTiles(term);

      tilesMap.forEach((values, x) => {
        values.forEach(y => {
          const leafNodePath = `${this.zoomLevel}/${x}/${y}`;
          const columnPath = `${this.zoomLevel}/${x}`;
          const pageSize = this.bucketizerOptions.pageSize!;
          const wktString = this.slippyMaps.getTileBoundingBoxWktString(x, y, this.zoomLevel);

          let metadata: ITileMetadata;
          if (this.tileMetadataMap.has(leafNodePath)) {
            metadata = this.tileMetadataMap.get(leafNodePath)!;

            if (metadata.memberCounter === pageSize) {
              this.updateTileMetadata(leafNodePath, columnPath, wktString, metadata);
            }
          } else {
            metadata = this.createTileMetadata(leafNodePath, columnPath, wktString);

            // Update hypermedia controls for root (extend polygon with bounding box of new tile)
            const rootHypermediaControls = this.getHypermediaControls(this.bucketizerOptions.root!)!;
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
                this.bucketizerOptions.root!,
                [...rootHypermediaControls, this.createRelationParameters(columnPath, wktString)],
              );
            }
          }

          buckets.push(`${leafNodePath}-${metadata.pageNumber}`);
          metadata.memberCounter++;
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
    state.tileMetadataMap = Array.from(this.tileMetadataMap.entries());

    return state;
  }

  public importState(state: any): void {
    super.importState(state);
    this.zoomLevel = state.zoomLevel;
    this.tileMetadataMap = new Map(state.tileMetadataMap);
  }

  private readonly createTileMetadata = (tilePath: string, columnPath: string, wktString: string): ITileMetadata => {
    const metadata: ITileMetadata = {
      pageNumber: 0,
      memberCounter: 0,
    };

    this.tileMetadataMap.set(tilePath, metadata);

    // Update column hypermedia controls
    this.updateColumnHypermediaControls(columnPath, tilePath, wktString, metadata.pageNumber);

    return metadata;
  };

  private readonly updateTileMetadata = (
    tilePath: string,
    columnPath: string,
    wktString: string,
    metadata: ITileMetadata,
  ): void => {
    metadata.pageNumber++;
    metadata.memberCounter = 0;

    // Add new page to column hypermedia controls
    this.updateColumnHypermediaControls(columnPath, tilePath, wktString, metadata.pageNumber);
  };

  private readonly updateColumnHypermediaControls = (
    columnPath: string,
    tilePath: string,
    wktString: string,
    pageNumber: number,
  ): void => {
    let columnHypermediaControls = this.getHypermediaControls(columnPath);
    const paginatedTilePath = `${tilePath}-${pageNumber}`;

    if (!columnHypermediaControls) {
      columnHypermediaControls = [];
    }

    this.addHypermediaControls(columnPath,
      [
        ...columnHypermediaControls,
        this.createRelationParameters(paginatedTilePath, wktString),
      ]);
  };
}
