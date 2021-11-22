import type * as RDF from '@rdfjs/types';
const turf = require('@turf/turf');
const dissolve = require('geojson-dissolve');
const bbox = require('slippy-bbox');
const { parse, stringify } = require('wkt');

export class SlippyMaps {
  public readonly zoomLevel: number;

  public constructor(zoomLevel: number) {
    this.zoomLevel = zoomLevel;
  }

  public calculateTiles(term: RDF.Term): Map<number, number[]> {
    const geoJson = this.toGeoJson(term);
    const coordinates: any[] = geoJson.type.toLowerCase() === 'point' ?
      [geoJson.coordinates] :
      this.flattenArray(geoJson.coordinates);

    // Map with X as key and Y values in array
    const tilesMap: Map<number, number[]> = new Map();

    coordinates.forEach(coordinate => {
      const latitude = Number.parseInt(coordinate[1], 10);
      const longitude = Number.parseInt(coordinate[0], 10);

      const x = this.longitudeToTile(longitude);
      const y = this.latitudeToTile(latitude);

      const leafNodes = tilesMap.get(x);

      if (!leafNodes || !leafNodes.includes(y)) {
        const updatedLeafNodes = leafNodes === undefined ? [y] : [...leafNodes, y];
        tilesMap.set(x, updatedLeafNodes);
      }
    });

    return tilesMap;
  }

  private toGeoJson(term: RDF.Term): any {
    const literal = <RDF.Literal>term;

    switch (literal.datatype.value) {
      case 'http://www.opengis.net/ont/geosparql#wktLiteral':
        return this.wktToGeoJson(literal.value);
      default:
        throw new Error(`[GeospatialBucketizer]: geospatial datatype not supported (only wkt).`);
    }
  }

  public getTileBoundingBoxWktString(x: number, y: number, zoom: number): string {
    const boundingBox = bbox(x, y, zoom);
    const geometry = turf.bboxPolygon(boundingBox).geometry;

    return stringify(geometry);
  }

  public mergePolygons(polygonWktStringA: string, polygonWktStringB: string): any {
    const geoA = parse(polygonWktStringA);
    const geoB = parse(polygonWktStringB);

    return stringify(dissolve([geoA, geoB]));
  }

  private wktToGeoJson(geoString: string): any {
    if (geoString.startsWith('<')) {
      geoString = geoString.slice(geoString.indexOf('>') + 1).trim();
    }
    return parse(geoString);
  }

  private longitudeToTile(longitude: number): number {
    return Math.floor((longitude + 180) / 360 * 2 ** this.zoomLevel);
  }

  private latitudeToTile(latitude: number): number {
    return Math.floor((1 - Math.log(Math.tan(latitude * Math.PI / 180) +
      1 / Math.cos(latitude * Math.PI / 180)) / Math.PI) / 2 * 2 ** this.zoomLevel);
  }

  private flattenArray(coordinates: any[]): any[] {
    // We need to flatten each array to a 2D array
    while (Array.isArray(coordinates[0][0])) {
      coordinates = coordinates.flat(1);
    }

    return coordinates;
  }
}
