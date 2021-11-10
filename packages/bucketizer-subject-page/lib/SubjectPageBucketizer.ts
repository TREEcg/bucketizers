import type * as RDF from '@rdfjs/types';
import type { BucketizerOptions } from '@treecg/types';
import { Bucketizer } from '@treecg/types';

export class SubjectPageBucketizer extends Bucketizer {
  private readonly propertyPath: string;

  private constructor(propertyPath: string) {
    super();
    this.propertyPath = propertyPath;
  }

  public static async build(bucketizerOptions: BucketizerOptions, state?: any): Promise<SubjectPageBucketizer> {
    if (!bucketizerOptions.propertyPath) {
      throw new Error(`[SubjectPageBucketizer]: Please provide a valid property path.`);
    }

    const bucketizer = new SubjectPageBucketizer(bucketizerOptions.propertyPath);

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
      throw new Error(`[SubjectPageBucketizer]: No matches found for property path "${this.propertyPath}"`);
    }

    const buckets = this.createBuckets(propertyPathObjects);
    const bucketTriples = buckets.map(bucket => this.createBucketTriple(bucket, memberId));

    quads.push(...bucketTriples);
  };

  protected createBuckets = (propertyPathObjects: RDF.Term[]): string[] => {
    const buckets: string[] = [];
    propertyPathObjects.forEach(propertyPathObject => {
      const parts = propertyPathObject.value.split('/');
      if (parts[parts.length - 1] !== undefined) {
        buckets.push(parts[parts.length - 1]);
      }
    });

    return buckets;
  };
}
