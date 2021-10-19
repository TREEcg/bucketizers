import type * as RDF from '@rdfjs/types';
import { Bucketizer } from '@treecg/types';

export class SubjectPageBucketizer extends Bucketizer {
  public propertyPath: string;

  public constructor(propertyPath: string) {
    super(propertyPath);
    this.propertyPath = propertyPath;
  }

  public static build = async (propertyPath: string): Promise<SubjectPageBucketizer> => {
    const bucketizer = new SubjectPageBucketizer(propertyPath);
    await bucketizer.init();
    return bucketizer;
  };

  public bucketize = (quads: RDF.Quad[], memberId: string): void => {
    const propertyPathObjects: RDF.Term[] = this.extractPropertyPathObject(quads, memberId);

    if (propertyPathObjects.length <= 0) {
      throw new Error(`[SubjectPageBucketizer]: No matches found for property path "${this.propertyPath}"`);
    }

    const buckets = this.createBuckets(propertyPathObjects);
    const bucketTriples = buckets.map(bucket => this.createBucketTriple(bucket, memberId));

    quads.push(...bucketTriples);
  };

  public createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    const buckets: string[] = [];
    propertyPathObjects.forEach(propertyPathObject => {
      const parts = propertyPathObject.value.split('/');
      buckets.push(parts[parts.length - 1]);
    });

    return buckets;
  };
}