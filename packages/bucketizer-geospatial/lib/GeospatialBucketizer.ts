import type * as RDF from '@rdfjs/types';
import type { Partial } from '@treecg/bucketizer-core';
import { BucketizerCoreExt } from '@treecg/bucketizer-core';
import { RelationType } from '@treecg/types';
import type { RelationParameters, BucketizerCoreExtOptions } from '@treecg/types';
import { SlippyMaps } from './utils/SlippyMaps';

export interface ITileMetadata {
  pageNumber: number;
  memberCounter: number;
}

export type GeospatialInputType = Partial<BucketizerCoreExtOptions, { 'zoom': number }>;
export class GeospatialBucketizer extends BucketizerCoreExt<{ 'zoom': number }> {
  private zoomLevel: number;
  private readonly slippyMaps: SlippyMaps;

  // Store current page number and numbers of members for each tile (x/y)
  private tileMetadataMap: Map<string, ITileMetadata>;

  private constructor(bucketizerOptions: GeospatialInputType) {
    super(bucketizerOptions);

    this.zoomLevel = bucketizerOptions.zoom;
    this.slippyMaps = new SlippyMaps(bucketizerOptions.zoom);
    this.tileMetadataMap = new Map();

    this.setHypermediaControls(this.getRoot());
  }

  public static build(
    bucketizerOptions: GeospatialInputType,
    state?: any,
  ): GeospatialBucketizer {
    const bucketizer = new GeospatialBucketizer(bucketizerOptions);
    if (state) {
      bucketizer.importState(state);
    }
    return bucketizer;
  }

  protected createBuckets = (propertyPathObjects: RDF.Term[], newRelations: [string, RelationParameters][]): string[] => {
    const buckets: string[] = [];

    propertyPathObjects.forEach(term => {
      const tilesMap = this.slippyMaps.calculateTiles(term);

      tilesMap.forEach((values, x) => {
        values.forEach(y => {
          const leafNodePath = `${this.zoomLevel}/${x}/${y}`;
          const columnPath = `${this.zoomLevel}/${x}`;
          const pageSize = this.options.pageSize;
          const wktString = this.slippyMaps.getTileBoundingBoxWktString(x, y, this.zoomLevel);

          let metadata: ITileMetadata;
          if (this.tileMetadataMap.has(leafNodePath)) {
            metadata = this.tileMetadataMap.get(leafNodePath)!;

            if (metadata.memberCounter === pageSize) {
              this.updateTileMetadata(leafNodePath, columnPath, wktString, metadata, newRelations);
            }
          } else {
            metadata = this.createTileMetadata(leafNodePath, columnPath, wktString, newRelations);

            // Update hypermedia controls for root (extend polygon with bounding box of new tile)
            const rootHypermediaControls = this.getHypermediaControls(this.getRoot())!;
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
              const parameters = this.createRelationParameters(columnPath, wktString);
              this.addHypermediaControls(
                this.getRoot(),
                parameters,
              );

              newRelations.push([this.getRoot(), parameters]);
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

  private readonly createTileMetadata = (tilePath: string, columnPath: string, wktString: string, newRelations: [string, RelationParameters][]): ITileMetadata => {
    const metadata: ITileMetadata = {
      pageNumber: 0,
      memberCounter: 0,
    };

    this.tileMetadataMap.set(tilePath, metadata);

    // Update column hypermedia controls
    this.updateColumnHypermediaControls(columnPath, tilePath, wktString, metadata.pageNumber, newRelations);

    return metadata;
  };

  private readonly updateTileMetadata = (
    tilePath: string,
    columnPath: string,
    wktString: string,
    metadata: ITileMetadata,
    newRelations: [string, RelationParameters][],
  ): void => {
    metadata.pageNumber++;
    metadata.memberCounter = 0;

    // Add new page to column hypermedia controls
    this.updateColumnHypermediaControls(columnPath, tilePath, wktString, metadata.pageNumber, newRelations);
  };

  private readonly updateColumnHypermediaControls = (
    columnPath: string,
    tilePath: string,
    wktString: string,
    pageNumber: number,
    newRelations: [string, RelationParameters][],
  ): void => {
    let columnHypermediaControls = this.getHypermediaControls(columnPath);
    const paginatedTilePath = `${tilePath}-${pageNumber}`;

    if (!columnHypermediaControls) {
      columnHypermediaControls = [];
    }

    const parameters = this.createRelationParameters(paginatedTilePath, wktString);
    this.addHypermediaControls(columnPath, parameters);
    newRelations.push([columnPath, parameters]);
  };
}
